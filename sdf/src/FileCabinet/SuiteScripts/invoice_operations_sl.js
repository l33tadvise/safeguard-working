/**
 * Invoice Operations Suitelet  (v6.1 — 13-Jun-2025)
 *
 * @NApiVersion 2.1
 * @NScriptType  Suitelet
 */
define([
    'N/search',
    'N/record',
    'N/url',
    'N/redirect',
    'N/log',
    './pledge_invoice_engine_lib'
], function (search, record, url, redirect, log, invoiceEngine) {

/* ===================================================================== */
function onRequest (ctx) {
    var p   = ctx.request.parameters;
    var res = ctx.response;
    var act = (p.action || '').toLowerCase();

    try {
        switch (act) {
            case 'validate_pledge_order'   : return json(res, validatePledgeOrder(p));
            case 'validate_schedule'       : return json(res, validateSchedule(p));
            case 'create_from_pledge_order': return createFromPledgeOrder(p, res);
            case 'create_from_schedule'    : return createFromSchedule(p, res);
            default: return json(res, { success:false, message:'Unknown action: ' + act });
        }
    } catch (e) {
        log.error('Suitelet error', e);
        return json(res, { success:false, message:e.message });
    }
}

/* ---------- VALIDATE: single schedule ---------- */
function validateSchedule (p) {
    var schedId = Number(p.scheduleId) || 0;
    if (!schedId) throw new Error('Schedule ID parameter is required');

    try {
        var sd = invoiceEngine.loadScheduleData(schedId);
        invoiceEngine.validateSalesOrderForInvoicing(sd.linkedPledgeOrder);
        return { success:true, eligible:true, message:'Schedule is eligible for invoice creation' };
    } catch (err) {
        return { success:true, eligible:false, message:'Schedule is not eligible: ' + err.message };
    }
}

/* ---------- VALIDATE: entire pledge order ---------- */
function validatePledgeOrder (p) {
    var poId = Number(p.pledgeOrderId) || 0;
    if (!poId) throw new Error('Pledge Order ID parameter is required');

    var soFields = search.lookupFields({
        type   : search.Type.SALES_ORDER,
        id     : poId,
        columns: ['custbody_pledge_rev_posted', 'custbody_legacy_rev_recognized']
    });
    
    var revPosted = soFields.custbody_pledge_rev_posted === true;
    var legacyRevRecognized = soFields.custbody_legacy_rev_recognized === true;
    var revenueEligible = revPosted || legacyRevRecognized;

    var schedTotal = search.create({
        type   : 'customrecord_pledge_schedule',
        filters: [['custrecord_linked_pledge_order', 'anyof', poId]],
        columns: ['internalid']
    }).runPaged({ pageSize: 1 }).count;

    var eligScheds = invoiceEngine.findEligibleSchedulesForSalesOrder(poId);
    var eligCount  = eligScheds.length;
    var totalAmt   = eligScheds.reduce(function (s, r) { return s + parseFloat(r.amount || 0); }, 0);

    var eligible = false, msg = '';
    if (!revenueEligible) {
        if (schedTotal === 0)          msg = 'Revenue has not been posted AND no pledge schedules exist.';
        else if (eligCount === 0)      msg = 'Revenue has not been posted. No schedules are due yet.';
        else msg = 'Revenue has not been posted. There ' + (eligCount === 1 ? 'is ' : 'are ') +
                   eligCount + ' schedule line' + (eligCount > 1 ? 's' : '') +
                   ' ready to bill for a total of $' + totalAmt.toFixed(2) + '.';
    } else {
        if (schedTotal === 0)          msg = 'Revenue is posted, but no pledge schedules exist.';
        else if (eligCount === 0)      msg = 'Revenue is posted, but no pledge schedules are currently due.';
        else { eligible = true; msg = eligCount + ' installment' + (eligCount > 1 ? 's are' : ' is') + ' ready for invoicing.'; }
    }

    return {
        success:true, eligible:eligible, revenuePosted:revenueEligible,
        scheduleCount:schedTotal, eligibleCount:eligCount, totalAmount:totalAmt,
        message:msg, schedules:eligScheds
    };
}
/* ---------- CREATE: invoices from an entire pledge order ---------- */
function createFromPledgeOrder (p, res) {
    var poId      = Number(p.pledgeOrderId) || 0;
    var returnUrl = p.returnUrl;
    if (!poId) throw new Error('Pledge Order ID parameter is required');

    var batch = invoiceEngine.createInvoicesForPledgeOrder(poId);
    var invoiceIds = (batch.successfulInvoices || []).map(function (row) { return row.invoiceId; });

    log.audit('Invoices created', { pledgeOrder: poId, invoiceIds: invoiceIds });

    var totalAmount = 0;
    invoiceIds.forEach(function (id) {
        totalAmount += record.load({ type: 'invoice', id: id }).getValue('total');
    });

    var target = returnUrl || url.resolveRecord({
        recordType: record.Type.SALES_ORDER,
        recordId  : poId,
        isEdit    : false
    });

    var redirectUrl = target +
        '&invCount=' + invoiceIds.length +
        '&invTotal=' + totalAmount.toFixed(2) +
        '&invFirst=' + (invoiceIds[0] || '');

    return redirect.redirect({ url: redirectUrl });
}

/* ---------- CREATE: single invoice from one schedule ---------- */
function createFromSchedule (p, res) {
    var schedId   = Number(p.scheduleId) || 0;
    var returnUrl = p.returnUrl;
    if (!schedId) throw new Error('Schedule ID parameter is required');

    var invResult = invoiceEngine.createInvoiceFromSchedule(schedId);
    var invId     = invResult && invResult.invoiceId;

    log.audit('Invoice created', { schedule: schedId, invoiceId: invId });

    if (!invId) {
        return json(res, { success: false, message: 'Failed to create invoice.' });
    }

    var invTotal = record.load({ type: 'invoice', id: invId }).getValue('total');

    var target = returnUrl || url.resolveRecord({
        recordType: 'customrecord_pledge_schedule',
        recordId  : schedId,
        isEdit    : false
    });

    var redirectUrl = target +
        '&invCount=1' +
        '&invTotal=' + invTotal.toFixed(2) +
        '&invFirst=' + invId;

    return redirect.redirect({ url: redirectUrl });
}

/* ---------- tiny JSON helper ---------- */
function json (response, obj) {
    response.setHeader({ name: 'Content-Type', value: 'application/json' });
    response.write(JSON.stringify(obj));
}

/* ---------- expose entry point ---------- */
return { onRequest: onRequest };

});