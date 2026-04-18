/**
 * Bulk Pledge-Invoice Suitelet – Final: Full error messages + Safe Date + GCS ID
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define([
  'N/ui/serverWidget',
  'N/search',
  'N/url',
  'N/runtime',
  'N/redirect',
  'N/log',
  './pledge_invoice_engine_lib'
], function (ui, search, url, runtime, redirect, log, engine) {

  function onRequest(ctx) {
    if (ctx.request.method === 'POST' && ctx.request.parameters.custpage_action === 'create') {
      return handleCreate(ctx);
    }
    return renderForm(ctx);
  }

  function renderForm(ctx) {
    const p = ctx.request.parameters || {};

    // ✅ Default billing cutoff to end of current month only on initial load (not on Search)
    
const isInitialLoad = ctx.request.method === 'GET' && !ctx.request.parameters.hasOwnProperty('custpage_action');
if (isInitialLoad && !p.custpage_billdate) {
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const mm = String(endOfMonth.getMonth() + 1).padStart(2, '0');
  const dd = String(endOfMonth.getDate()).padStart(2, '0');
  const yyyy = endOfMonth.getFullYear();
  p.custpage_billdate = `${mm}/${dd}/${yyyy}`;
}


    const form = ui.createForm({ title: '📋 Bulk Pledge Invoice Processing' });
    form.clientScriptModulePath = './bulk_pledge_invoice_client.js';

    if (p.invCount) {
      const invCount = parseInt(p.invCount, 10);
      const invTotal = parseFloat(p.invTotal || '0');
      form.addPageInitMessage({
        type: 'CONFIRMATION',
        title: '✅ Invoice Creation Successful',
        message: `Successfully created ${invCount} invoice${invCount > 1 ? 's' : ''} totaling $${invTotal.toFixed(2)}${p.invFirst ? `. First invoice ID: ${p.invFirst}` : ''}`,
        duration: 0
      });
    }

    if (p.custpage_error) {
      form.addPageInitMessage({
        type: 'ERROR',
        title: '⚠️ Processing Errors',
        message: decodeURIComponent(p.custpage_error),
        duration: 0
      });
    }

    form.addFieldGroup({ id: 'filters', label: '🔍 Search Filters' });
    form.addField({ id: 'custpage_billdate', type: ui.FieldType.DATE, label: 'Billing Cutoff Date (On or Before)', container: 'filters' }).defaultValue = p.custpage_billdate;
    form.addField({ id: 'custpage_pledge_date_from', type: ui.FieldType.DATE, label: 'Pledge Order Date From', container: 'filters' });
    form.addField({ id: 'custpage_pledge_date_to', type: ui.FieldType.DATE, label: 'Pledge Order Date To', container: 'filters' });
    form.addField({ id: 'custpage_order_amt_from', type: ui.FieldType.CURRENCY, label: 'Pledge Order Amount From', container: 'filters' }).defaultValue = p.custpage_order_amt_from || '';
    form.addField({ id: 'custpage_order_amt_to', type: ui.FieldType.CURRENCY, label: 'Pledge Order Amount To', container: 'filters' }).defaultValue = p.custpage_order_amt_to || '';
    form.addField({ id: 'custpage_constituent', type: ui.FieldType.SELECT, label: 'Constituent', source: 'customer', container: 'filters' }).defaultValue = p.custpage_constituent || '';

    form.addField({ id: 'custpage_action', type: ui.FieldType.TEXT, label: 'Action' }).updateDisplayType({ displayType: ui.FieldDisplayType.HIDDEN });
    form.addField({ id: 'custpage_selected_ids', type: ui.FieldType.LONGTEXT, label: 'Selected IDs' }).updateDisplayType({ displayType: ui.FieldDisplayType.HIDDEN });

    form.addFieldGroup({ id: 'summarygroup', label: '📊 Selection Summary' });
    form.addField({ id: 'custpage_selected_count', type: ui.FieldType.INTEGER, label: 'Records Selected', container: 'summarygroup' }).updateDisplayType({ displayType: ui.FieldDisplayType.INLINE }).defaultValue = '0';
    form.addField({ id: 'custpage_selected_total', type: ui.FieldType.CURRENCY, label: 'Total Amount Selected', container: 'summarygroup' }).updateDisplayType({ displayType: ui.FieldDisplayType.INLINE }).defaultValue = '0.00';

    const results = getSearchResults(p);

    const sublist = form.addSublist({ id: 'custpage_results', type: ui.SublistType.LIST, label: `📋 Eligible Pledge Schedules (${results.length} found)` });
    sublist.addMarkAllButtons();
    sublist.addField({ id: 'custpage_select', label: 'Select', type: ui.FieldType.CHECKBOX });
    sublist.addField({ id: 'custpage_schedid', label: 'Schedule ID', type: ui.FieldType.TEXT }).updateDisplayType({ displayType: ui.FieldDisplayType.HIDDEN });
    sublist.addField({ id: 'custpage_gcs', label: 'GCS (Internal ID)', type: ui.FieldType.TEXT });
    sublist.addField({ id: 'custpage_installdate', label: 'Installment Date', type: ui.FieldType.DATE });
    sublist.addField({ id: 'custpage_install_amt', label: 'Installment Amount', type: ui.FieldType.CURRENCY });
    sublist.addField({ id: 'custpage_linked_invoice', label: 'Linked Invoice', type: ui.FieldType.TEXT });
    sublist.addField({ id: 'custpage_pledge_order_date', label: 'Pledge Order Date', type: ui.FieldType.DATE });
    sublist.addField({ id: 'custpage_linked_order', label: 'Pledge Order', type: ui.FieldType.TEXT });
    sublist.addField({ id: 'custpage_constituent', label: 'Constituent', type: ui.FieldType.TEXT });
    sublist.addField({ id: 'custpage_order_amt', label: 'Pledge Order Amount', type: ui.FieldType.CURRENCY });

    results.forEach((r, i) => {
      sublist.setSublistValue({ id: 'custpage_schedid', line: i, value: r.id });
      if (r.gcs) sublist.setSublistValue({ id: 'custpage_gcs', line: i, value: String(r.gcs) });
      if (r.installment) sublist.setSublistValue({ id: 'custpage_installdate', line: i, value: r.installment });
      if (r.amount) sublist.setSublistValue({ id: 'custpage_install_amt', line: i, value: r.amount });
      if (r.invoice) sublist.setSublistValue({ id: 'custpage_linked_invoice', line: i, value: r.invoice });
      if (r.pledge_order_date) sublist.setSublistValue({ id: 'custpage_pledge_order_date', line: i, value: r.pledge_order_date });
      if (r.order) sublist.setSublistValue({ id: 'custpage_linked_order', line: i, value: r.order });
      if (r.constituent) sublist.setSublistValue({ id: 'custpage_constituent', line: i, value: r.constituent });
      if (r.order_amt) sublist.setSublistValue({ id: 'custpage_order_amt', line: i, value: r.order_amt });
    });

    if (results.length > 0) {
      form.addButton({ id: 'custpage_create', label: '📋 Create Invoices', functionName: 'bulkCreateInvoices' });
    } else {
      form.addPageInitMessage({
        type: 'INFORMATION',
        title: '🔍 No Results',
        message: 'No eligible pledge schedules found. Try adjusting filters.',
        duration: 0
      });
    }

    form.addSubmitButton({ label: '🔍 Search' });
    ctx.response.writePage(form);
  }

  function getSearchResults(p) {
    const filters = [
      ['custrecord_isbilled', 'is', 'F'], 'AND',
      ['custrecord_po_invoice', 'anyof', '@NONE@']
    ];

    if (p.custpage_billdate) filters.push('AND', ['custrecord_ps_installment_date', 'onorbefore', p.custpage_billdate]);
    if (p.custpage_pledge_date_from) filters.push('AND', ['custrecord_linked_pledge_date', 'onorafter', p.custpage_pledge_date_from]);
    if (p.custpage_pledge_date_to) filters.push('AND', ['custrecord_linked_pledge_date', 'onorbefore', p.custpage_pledge_date_to]);
    if (p.custpage_order_amt_from) filters.push('AND', ['custrecord_linked_pledge_order_amt', 'greaterthanorequalto', p.custpage_order_amt_from]);
    if (p.custpage_order_amt_to) filters.push('AND', ['custrecord_linked_pledge_order_amt', 'lessthanorequalto', p.custpage_order_amt_to]);
    if (p.custpage_constituent) filters.push('AND', ['custrecord_linked_po_constituent', 'anyof', p.custpage_constituent]);

    const ss = search.create({
      type: 'customrecord_pledge_schedule',
      filters: filters,
      columns: [
        'internalid',
        'custrecord_ps_installment_date',
        'custrecord_ps_installment_amt',
        'custrecord_po_invoice',
        'custrecord_linked_pledge_order',
        'custrecord_linked_po_constituent',
        'custrecord_linked_pledge_order_amt',
        'custrecord_linked_pledge_date',
        'custrecord_sf_gcs'
      ]
    });

    const results = [];
    ss.run().each(res => {
      results.push({
        id: res.getValue('internalid'),
        installment: res.getValue('custrecord_ps_installment_date'),
        amount: res.getValue('custrecord_ps_installment_amt'),
        invoice: res.getText('custrecord_po_invoice'),
        order: res.getText('custrecord_linked_pledge_order'),
        constituent: res.getText('custrecord_linked_po_constituent'),
        order_amt: res.getValue('custrecord_linked_pledge_order_amt'),
        pledge_order_date: res.getValue('custrecord_linked_pledge_date'),
        gcs: res.getValue('custrecord_sf_gcs')
      });
      return true;
    });
    return results;
  }

function handleCreate(ctx) {
    const p = ctx.request.parameters;
    const selectedIds = (p.custpage_selected_ids || '').split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
    const created = [], errors = [];
    let total = 0;
    
    selectedIds.forEach(schedId => {
      try {
        log.debug('Processing schedule', schedId);
        const result = engine.createInvoiceFromSchedule(schedId);
        log.debug('Schedule result', result);
        
        if (result && result.invoiceId) {
          created.push(result.invoiceId);
          const amt = parseFloat(result.amount || 0);
          if (!isNaN(amt)) total += amt;
        } else {
          if (result && result.error) {
            errors.push(`Schedule ${schedId} failed: ${result.error}`);
          } else {
            errors.push(`Schedule ${schedId} failed (unknown reason).`);
          }
        }
      } catch (e) {
        log.debug('Schedule failed', {schedId: schedId, error: e.message});
        errors.push(`Schedule ${schedId} error: ${e.message}`);
      }
    });
    
    let target = url.resolveScript({
      scriptId: runtime.getCurrentScript().id,
      deploymentId: runtime.getCurrentScript().deploymentId
    });
    let paramJoiner = target.includes('?') ? '&' : '?';
    if (created.length > 0) {
      target += `${paramJoiner}invCount=${created.length}&invTotal=${total.toFixed(2)}&invFirst=${created[0]}`;
      paramJoiner = '&';
    }
    if (errors.length > 0) {
      target += `${paramJoiner}custpage_error=${encodeURIComponent(errors.join('; '))}`;
    }
    redirect.redirect({ url: target });
} // ← CLOSE THE FUNCTION HERE

return { onRequest }; // ← THIS GOES OUTSIDE THE FUNCTION
});