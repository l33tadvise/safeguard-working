/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * 
 * BULK PLEDGE ORDER PROCESSING SUITELET - ROCK SOLID
 * Script ID: customscript_bulk_processing_sl
 * Uses shared revenue engine for bulletproof reliability - NO HTTP CALLS
 */
define(['N/ui/serverWidget', 'N/search', 'N/record', 'N/log', 'N/runtime', './revenue_engine_lib'], 
(serverWidget, search, record, log, runtime, revenueEngine) => {

// Add this back at the top
const PLEDGE_RECEIVABLE_ACCT = '741';

  
  function onRequest(context) {
    if (context.request.method === 'GET') {
      showSearchForm(context);
    } else if (context.request.method === 'POST') {
      const action = context.request.parameters.action;
      if (action && ['create', 'hold', 'release'].includes(action)) {
        processBulkAction(context);
      } else {
        showSearchForm(context);
      }
    }
  }

  function showSearchForm(context) {
    const form = serverWidget.createForm({ title: 'Bulk Pledge Order Processing' });

    // Check for processing results to display
    const processingResults = context.request.parameters.processing_results;
    if (processingResults) {
      try {
        const results = JSON.parse(processingResults);
        const action = context.request.parameters.last_action || 'operation';

        let messageText = `Bulk ${action} complete: ${results.success} successful, ${results.failed} failed`;
        if (results.errors.length > 0) {
          messageText += `<br>Errors: ${results.errors.slice(0, 3).join('<br>')}`;
          if (results.errors.length > 3) messageText += `<br>... and ${results.errors.length - 3} more`;
        }

        form.addPageInitMessage({
          type: results.success > 0 ? 'CONFIRMATION' : 'ERROR', 
          title: `Bulk Processing Complete`,
          message: messageText,
          duration: 0
        });
      } catch (e) {
        form.addPageInitMessage({
          type: 'ERROR',
          title: 'Failed to parse processing results',
          message: 'Could not parse processing results. Check logs for detail.',
          duration: 0
        });
        log.error('Processing Results Parse Error', e.message);
      }
    }

    form.addPageInitMessage({
      type: 'INFORMATION',
      title: 'Bulk Processing',
      message: 'Search for pledge orders and perform bulk operations. Use filters to narrow your results.',
      duration: 0
    });

    const filterGroup = form.addFieldGroup({ id: 'filters', label: 'Search Filters' });

    const dateFrom = form.addField({ id: 'custpage_date_from', type: serverWidget.FieldType.DATE, label: 'Date From', container: 'filters' });
    const dateTo = form.addField({ id: 'custpage_date_to', type: serverWidget.FieldType.DATE, label: 'Date To', container: 'filters' });
    const amountFrom = form.addField({ id: 'custpage_amount_from', type: serverWidget.FieldType.CURRENCY, label: 'Amount From', container: 'filters' });
    const amountTo = form.addField({ id: 'custpage_amount_to', type: serverWidget.FieldType.CURRENCY, label: 'Amount To', container: 'filters' });

    const revenueStatus = form.addField({ id: 'custpage_revenue_status', type: serverWidget.FieldType.SELECT, label: 'Revenue Status', container: 'filters' });
    revenueStatus.addSelectOption({ value: '', text: '- All -' });
    revenueStatus.addSelectOption({ value: 'ready', text: 'Ready to Create Revenue Posting' });
    revenueStatus.addSelectOption({ value: 'created', text: 'Revenue Created - Not Posted' });
    revenueStatus.addSelectOption({ value: 'posted', text: 'Posted' });
    revenueStatus.addSelectOption({ value: 'held', text: 'On Hold' });

    const sortField = form.addField({ id: 'custpage_sort_by', type: serverWidget.FieldType.SELECT, label: 'Sort By', container: 'filters' });
    sortField.addSelectOption({ value: 'amount_asc', text: 'Amount (Low to High)' });
    sortField.addSelectOption({ value: 'amount_desc', text: 'Amount (High to Low)' });
    sortField.addSelectOption({ value: 'date_asc', text: 'Date (Oldest First)' });
    sortField.addSelectOption({ value: 'date_desc', text: 'Date (Newest First)' });
    sortField.addSelectOption({ value: 'customer', text: 'Customer Name' });

    form.addField({ id: 'custpage_customer', type: serverWidget.FieldType.SELECT, label: 'Constituent', source: 'customer', container: 'filters' });

    const preserveFilters = true; 

    if (preserveFilters) {
      if (context.request.parameters.custpage_date_from) dateFrom.defaultValue = context.request.parameters.custpage_date_from;
      if (context.request.parameters.custpage_date_to) dateTo.defaultValue = context.request.parameters.custpage_date_to;
      if (context.request.parameters.custpage_amount_from) amountFrom.defaultValue = context.request.parameters.custpage_amount_from;
      if (context.request.parameters.custpage_amount_to) amountTo.defaultValue = context.request.parameters.custpage_amount_to;
      if (context.request.parameters.custpage_revenue_status) revenueStatus.defaultValue = context.request.parameters.custpage_revenue_status;
      if (context.request.parameters.custpage_sort_by) sortField.defaultValue = context.request.parameters.custpage_sort_by;
      if (context.request.parameters.custpage_customer) form.getField('custpage_customer').defaultValue = context.request.parameters.custpage_customer;
    }

    form.addSubmitButton({ label: 'Search Pledge Orders' });
    form.addButton({ id: 'custpage_clear_search', label: 'Clear Search', functionName: 'clearSearch()' });

    showSearchResults(form, context.request.parameters);

    context.response.writePage(form);
  }

  function showSearchResults(form, params) {
    const sortBy = params.custpage_sort_by || 'amount_asc';
    let sortColumn, sortDirection;

    switch (sortBy) {
      case 'amount_asc': sortColumn = 'total'; sortDirection = search.Sort.ASC; break;
      case 'amount_desc': sortColumn = 'total'; sortDirection = search.Sort.DESC; break;
      case 'date_asc': sortColumn = 'trandate'; sortDirection = search.Sort.ASC; break;
      case 'date_desc': sortColumn = 'trandate'; sortDirection = search.Sort.DESC; break;
      case 'customer': sortColumn = 'entity'; sortDirection = search.Sort.ASC; break;
      default: sortColumn = 'total'; sortDirection = search.Sort.ASC;
    }

    const pledgeSearch = search.create({
      type: search.Type.SALES_ORDER,
      filters: buildSearchFilters(params),
      columns: [
        'transactionname',
        'trandate',
        'entity',
        'total',
        'custbody_pledge_rev_posted',
        'custbody_pledge_rev_txn_id',
        'custbody_pledge_rev_amount',
        'custbody_revenue_hold'
      ]
    });

    if (sortColumn && sortDirection) {
      pledgeSearch.columns.forEach((column, index) => {
        if ((typeof column === 'string' && column === sortColumn) || 
            (typeof column === 'object' && column.name === sortColumn)) {
          pledgeSearch.columns[index] = search.createColumn({ name: sortColumn, sort: sortDirection });
        }
      });
    }

    form.addFieldGroup({ id: 'selection_summary', label: 'Selection Summary' });

    const selectedCountField = form.addField({ id: 'custpage_selected_count', type: serverWidget.FieldType.INTEGER, label: 'Records Selected', container: 'selection_summary' });
    selectedCountField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.INLINE });
    selectedCountField.defaultValue = '0';

    const selectedAmountField = form.addField({ id: 'custpage_selected_amount', type: serverWidget.FieldType.CURRENCY, label: 'Total Amount Selected', container: 'selection_summary' });
    selectedAmountField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.INLINE });
    selectedAmountField.defaultValue = '0.00';

    const sublist = form.addSublist({ id: 'custpage_results', type: serverWidget.SublistType.LIST, label: 'Search Results' });

    sublist.addField({ id: 'custpage_select', type: serverWidget.FieldType.CHECKBOX, label: 'Select' });
    sublist.addField({ id: 'custpage_tranid', type: serverWidget.FieldType.TEXT, label: 'SO Number' });
    sublist.addField({ id: 'custpage_date', type: serverWidget.FieldType.DATE, label: 'Date' });
    sublist.addField({ id: 'custpage_customer', type: serverWidget.FieldType.TEXT, label: 'Constituent' });
    sublist.addField({ id: 'custpage_amount', type: serverWidget.FieldType.CURRENCY, label: 'Amount' });
    sublist.addField({ id: 'custpage_revenue_status', type: serverWidget.FieldType.TEXT, label: 'Revenue Status' });
    sublist.addField({ id: 'custpage_revenue_txn_id', type: serverWidget.FieldType.TEXT, label: 'Revenue Transaction ID' });
    sublist.addField({ id: 'custpage_internal_id', type: serverWidget.FieldType.TEXT, label: 'Internal ID' }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });

    let lineNum = 0;
    const processedSOs = new Set();

    pledgeSearch.run().each(result => {
      if (lineNum >= 1000) return false;

      const soId = result.id;
      if (processedSOs.has(soId)) return true;
      processedSOs.add(soId);

      const revenuePosted = result.getValue('custbody_pledge_rev_posted');
      const revenueTxnId = result.getValue('custbody_pledge_rev_txn_id');
      const revenueHold = result.getValue('custbody_revenue_hold');

      let revenueStatus = 'Ready to Create Revenue Posting';
      if (revenueHold === true || revenueHold === 'T') revenueStatus = 'On Hold';
      else if (revenuePosted === true || revenuePosted === 'T') revenueStatus = 'Posted';
      else if (revenueTxnId && revenueTxnId !== '' && revenueTxnId !== null) revenueStatus = 'Revenue Created - Not Posted';

      const filterStatus = params.custpage_revenue_status;
      if (filterStatus === 'ready' && revenueStatus !== 'Ready to Create Revenue Posting') return true;
      if (filterStatus === 'created' && revenueStatus !== 'Revenue Created - Not Posted') return true;
      if (filterStatus === 'posted' && revenueStatus !== 'Posted') return true;
      if (filterStatus === 'held' && revenueStatus !== 'On Hold') return true;

      const transactionName = result.getValue('transactionname') || `SO-${soId}`;
      const pledgeOrderUrl = `https://5411584-sb1.app.netsuite.com/app/accounting/transactions/salesord.nl?id=${soId}&whence=`;

      sublist.setSublistValue({ 
        id: 'custpage_tranid', 
        line: lineNum, 
        value: `<a href="${pledgeOrderUrl}" target="_blank">${transactionName}</a>` 
      });

      sublist.setSublistValue({ id: 'custpage_date', line: lineNum, value: result.getValue('trandate') || '' });
      sublist.setSublistValue({ id: 'custpage_customer', line: lineNum, value: result.getText('entity') || 'Unknown Constituent' });
      sublist.setSublistValue({ id: 'custpage_amount', line: lineNum, value: result.getValue('total') || 0 });
      sublist.setSublistValue({ id: 'custpage_revenue_status', line: lineNum, value: revenueStatus });

      if (revenueTxnId && revenueTxnId !== '' && revenueTxnId !== null) {
        const revenueUrl = `https://5411584-sb1.app.netsuite.com/app/accounting/transactions/cutrsale.nl?id=${revenueTxnId}&customtype=110&whence=`;
        sublist.setSublistValue({
          id: 'custpage_revenue_txn_id',
          line: lineNum,
          value: `<a href="${revenueUrl}" target="_blank">${revenueTxnId}</a>`
        });
      } else {
        sublist.setSublistValue({
          id: 'custpage_revenue_txn_id',
          line: lineNum,
          value: ' '
        });
      }

      sublist.setSublistValue({ id: 'custpage_internal_id', line: lineNum, value: soId });
      lineNum++;
      return true;
    });

    if (lineNum > 0) {
      form.addFieldGroup({ id: 'actions', label: `Bulk Actions (${lineNum} records found)` });
      form.addButton({ id: 'custpage_mark_all', label: 'Mark All', functionName: 'markAll()' });
      form.addButton({ id: 'custpage_unmark_all', label: 'Unmark All', functionName: 'unmarkAll()' });
      form.addButton({ id: 'custpage_bulk_create', label: 'Create Revenue Postings', functionName: 'bulkAction("create")' });
      form.addButton({ id: 'custpage_bulk_hold', label: 'Apply Revenue Hold', functionName: 'bulkAction("hold")' });
      form.addButton({ id: 'custpage_bulk_release', label: 'Release Revenue Hold', functionName: 'bulkAction("release")' });

      const script = runtime.getCurrentScript();
      const clientScriptId = script.getParameter('custscript_bulkprocess_client_script_id');
      if (clientScriptId) form.clientScriptFileId = parseInt(clientScriptId, 10);
      else form.clientScriptModulePath = './bulk_pledge_order_client.js';
    } else {
      form.addPageInitMessage({
        type: 'WARNING',
        title: 'No Records Found',
        message: 'No pledge orders match your current search criteria. Try adjusting your filters.',
        duration: 0
      });
    }
  }

  function buildSearchFilters(params) {
    const filters = [['custbody_npo_pledge_promise', 'is', 'T']];
    if (params.custpage_date_from) filters.push('AND', ['trandate', 'onorafter', params.custpage_date_from]);
    if (params.custpage_date_to) filters.push('AND', ['trandate', 'onorbefore', params.custpage_date_to]);
    if (params.custpage_amount_from) filters.push('AND', ['formulanumeric: {total}', 'greaterthanorequalto', params.custpage_amount_from]);
    if (params.custpage_amount_to) filters.push('AND', ['formulanumeric: {total}', 'lessthanorequalto', params.custpage_amount_to]);
    if (params.custpage_customer) filters.push('AND', ['entity', 'anyof', params.custpage_customer]);
    return filters;
  }

  function processBulkAction(context) {
    // Add logging to debug what we're receiving
    log.debug('Action Param', context.request.parameters.action);
    log.debug('Selected IDs Raw Param', context.request.parameters.selected_ids);
    
    const action = context.request.parameters.action;
    
    // Safer parsing with validation
    let selectedIds = [];
    try {
      const raw = context.request.parameters.selected_ids || '[]';
      selectedIds = JSON.parse(raw);
      if (!Array.isArray(selectedIds)) throw new Error('selected_ids is not an array');
    } catch (err) {
      log.error('Error parsing selected_ids', err.message);
      selectedIds = [];
    }

    if (!selectedIds.length) {
      // Build redirect URL manually
      let redirectUrl = `?`;
      for (let param in context.request.parameters) {
        if (param !== 'action' && param !== 'selected_ids') {
          redirectUrl += `${param}=${encodeURIComponent(context.request.parameters[param])}&`;
        }
      }
      redirectUrl += `processing_results=${encodeURIComponent(JSON.stringify({
        success: 0,
        failed: 0,
        errors: ['No records selected']
      }))}`;
      
      context.response.sendRedirect({
        type: 'SUITELET',
        identifier: runtime.getCurrentScript().id,
        id: runtime.getCurrentScript().deploymentId,
        parameters: redirectUrl
      });
      return;
    }

    try {
      // Use shared revenue engine for rock-solid processing
      const results = revenueEngine.processBulkRevenue(selectedIds, action);
      
      // Build redirect URL manually
      let redirectUrl = `?`;
      for (let param in context.request.parameters) {
        if (param !== 'action' && param !== 'selected_ids') {
          redirectUrl += `${param}=${encodeURIComponent(context.request.parameters[param])}&`;
        }
      }
      // Add action to redirect URL for better messaging
      redirectUrl += `last_action=${encodeURIComponent(action)}&processing_results=${encodeURIComponent(JSON.stringify(results))}`;
      
      context.response.sendRedirect({
        type: 'SUITELET',
        identifier: runtime.getCurrentScript().id,
        id: runtime.getCurrentScript().deploymentId,
        parameters: redirectUrl
      });

    } catch (e) {
      log.error('Bulk Processing Failed', e.toString());
      
      // Build error redirect URL manually
      let redirectUrl = `?`;
      for (let param in context.request.parameters) {
        if (param !== 'action' && param !== 'selected_ids') {
          redirectUrl += `${param}=${encodeURIComponent(context.request.parameters[param])}&`;
        }
      }
      redirectUrl += `processing_results=${encodeURIComponent(JSON.stringify({
        success: 0,
        failed: selectedIds.length,
        errors: [`System error: ${e.message}`]
      }))}`;
      
      context.response.sendRedirect({
        type: 'SUITELET',
        identifier: runtime.getCurrentScript().id,
        id: runtime.getCurrentScript().deploymentId,
        parameters: redirectUrl
      });
    }
  }

  return { onRequest };
});