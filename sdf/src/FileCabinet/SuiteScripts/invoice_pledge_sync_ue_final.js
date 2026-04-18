/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @description Invoice ↔ Pledge Schedule Sync (safe init + optional lib correction)
 */
define(['N/record','N/log','N/search','N/format','./pledge_schedule_sync_lib'],
function (record, log, search, format, psLib) {

  function afterSubmit(ctx) {
    var invRec  = (ctx.type === ctx.UserEventType.DELETE) ? ctx.oldRecord : ctx.newRecord;
    var invId   = invRec && invRec.id;
    var schedId = invRec && invRec.getValue && invRec.getValue('custbody_pledge_schedule_ref');

    log.audit('INV-UE heartbeat', { eventType: ctx.type, invId: invId, schedId: schedId });
    if (!invId || !schedId) return;

    try {
      // DELETE/VOID: clear linkage + meta
      if (ctx.type === ctx.UserEventType.DELETE || ctx.type === ctx.UserEventType.VOID) {
        // Option: hard reset Remaining to Installment — uncomment if you want that behavior
        // var install = Number((search.lookupFields({type:'customrecord_pledge_schedule', id:schedId, columns:['custrecord_ps_installment_amt']})
        //    .custrecord_ps_installment_amt) || 0);
        record.submitFields({
          type   : 'customrecord_pledge_schedule',
          id     : schedId,
          values : {
            custrecord_po_invoice         : '',
            custrecord_po_invoice_status  : '',
            custrecord_ps_payments        : 0,
            // custrecord_installment_amt_remaining : install, // ← optional hard reset
            custrecord_invoice_tran_date  : '',
            custrecord_isbilled           : false
          },
          options:{ ignoreMandatoryFields:true }
        });
        log.audit('INV-UE reset on delete/void', { schedId: schedId, invId: invId });
        return;
      }

      // -------- Create/Edit path --------
      var inv = record.load({ type: record.Type.INVOICE, id: invId });

      // CREATE: align invoice date to schedule installment date (keeps posting period sane)
      if (ctx.type === ctx.UserEventType.CREATE) {
        try {
          var sf = search.lookupFields({
            type: 'customrecord_pledge_schedule',
            id:   schedId,
            columns: ['custrecord_ps_installment_date']
          });
          var instDate = sf.custrecord_ps_installment_date;
          if (instDate) {
            var parsed = format.parse({ value: instDate, type: format.Type.DATE });
            record.submitFields({
              type: record.Type.INVOICE,
              id:   invId,
              values: { trandate: parsed },
              options: { ignoreMandatoryFields: true }
            });
            inv = record.load({ type: record.Type.INVOICE, id: invId }); // refresh posting period
            log.audit('INV-UE set trandate from schedule', {
              invId: invId, schedId: schedId,
              trandate: parsed,
              postingPeriodId: inv.getValue('postingperiod'),
              postingPeriodText: inv.getText('postingperiod')
            });
          }
        } catch (eDate) {
          log.error('INV-UE date alignment failed', { invId: invId, schedId: schedId, message: eDate.message });
        }
      }

      // Mirror meta to schedule (status/period/date)
      var statusTx  = inv.getText('status') || '';
      var postPerId = inv.getValue('postingperiod');
      var trandate  = inv.getValue('trandate');

      record.submitFields({
        type   : 'customrecord_pledge_schedule',
        id     : schedId,
        values : {
          custrecord_po_invoice_status  : statusTx,
          custrecord_period_restriction : postPerId || null,
          custrecord_invoice_tran_date  : trandate || null
        },
        options:{ ignoreMandatoryFields:true }
      });
      log.debug('INV-UE mirrored meta', { schedId: schedId, statusTx: statusTx, postPerId: postPerId, trandate: trandate });

      // -------- SAFETY INIT (guarantee not-null) --------
      // Initialize Paid/Remaining immediately so UI is never blank after Create Invoice.
      try {
        var schedVals = search.lookupFields({
          type: 'customrecord_pledge_schedule',
          id:   schedId,
          columns: ['custrecord_ps_installment_amt','custrecord_ps_payments','custrecord_installment_amt_remaining']
        });
        var install   = Number(schedVals.custrecord_ps_installment_amt || 0);
        var existingPaid = (schedVals.custrecord_ps_payments === '' || schedVals.custrecord_ps_payments == null)
                           ? null : Number(schedVals.custrecord_ps_payments);
        var existingRem  = (schedVals.custrecord_installment_amt_remaining === '' || schedVals.custrecord_installment_amt_remaining == null)
                           ? null : Number(schedVals.custrecord_installment_amt_remaining);

        var headerPaid = Number(inv.getValue('amountpaid') || 0); // 0 immediately after create

        var initValues = {};
        if (existingPaid === null) initValues.custrecord_ps_payments = headerPaid;      // 0.00 at create
        if (existingRem  === null) initValues.custrecord_installment_amt_remaining = (install - (existingPaid===null?headerPaid:existingPaid));

        if (Object.keys(initValues).length){
          record.submitFields({
            type: 'customrecord_pledge_schedule',
            id:   schedId,
            values: initValues,
            options: { ignoreMandatoryFields:true }
          });
          log.audit('INV-UE safety init wrote values', { schedId: schedId, initValues: initValues });
        } else {
          log.debug('INV-UE safety init skipped (values already present)', { schedId: schedId });
        }
      } catch (eInit) {
        log.error('INV-UE safety init failed', { schedId: schedId, message: eInit.message, stack: eInit.stack });
      }

      // -------- Optional Correction via lib (applied-line truth) --------
      try {
        if (psLib && psLib.syncFromInvoice) {
          psLib.syncFromInvoice(invId);
          var verify = search.lookupFields({
            type: 'customrecord_pledge_schedule',
            id:   schedId,
            columns: ['custrecord_ps_payments','custrecord_installment_amt_remaining']
          });
          log.audit('INV-UE lib correction OK', {
            invId: invId, schedId: schedId,
            paid: verify.custrecord_ps_payments,
            remaining: verify.custrecord_installment_amt_remaining
          });
        } else {
          log.debug('INV-UE lib not available (skipping correction)', {});
        }
      } catch (eLib) {
        log.error('INV-UE lib correction failed (non-fatal)', { invId: invId, schedId: schedId, message: eLib.message, stack: eLib.stack });
      }

    } catch (e) {
      log.error('INV-UE fatal', { message: e.message, stack: e.stack });
    }
  }

  return { afterSubmit: afterSubmit };
});
