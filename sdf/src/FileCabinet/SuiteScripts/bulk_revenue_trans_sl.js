/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * 
 * BULK REVENUE TRANSACTION PROCESSING SUITELET - COPIED FROM WORKING BULK PLEDGE PATTERN
 * Script ID: customscript_bulk_revenue_trans_sl
 */
define(['N/ui/serverWidget', 'N/search', 'N/record', 'N/log', 'N/runtime', './revenue_txn_posting_lib'], 
(serverWidget, search, record, log, runtime, revenueLib) => {

  function onRequest(context) {
    if (context.request.method === 'GET') {
      showSearchForm(context);
    } else if (context.request.method === 'POST') {
      const action = context.request.parameters.action;
      if (action && ['post', 'void', 'cancel'].includes(action)) {
        processBulkAction(context);
      } else {
        showSearchForm(context);
      }
    }
  }

  function showSearchForm(context) {
    const form = serverWidget.createForm({ title: 'Bulk Revenue Transaction Processing' });

    // Check if this is a clear search redirect
    const clearSearch = context.request.parameters.clear_search;
    if (clearSearch === 'true') {
      form.addPageInitMessage({
        type: 'CONFIRMATION',
        title: 'Revenue Transactions',
        message: 'Search filters cleared',
        duration: 0
      });
    }

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
      title: 'Bulk Revenue Operations',
      message: 'Search for pledge orders with revenue transactions and perform bulk operations. Use filters to narrow your results.',
      duration: 0
    });

    const filterGroup = form.addFieldGroup({ id: 'filters', label: 'Search Filters' });

    const dateFrom = form.addField({ id: 'custpage_date_from', type: serverWidget.FieldType.DATE, label: 'Pledge Date From', container: 'filters' });
    const dateTo = form.addField({ id: 'custpage_date_to', type: serverWidget.FieldType.DATE, label: 'Pledge Date To', container: 'filters' });
    const amountFrom = form.addField({ id: 'custpage_amount_from', type: serverWidget.FieldType.CURRENCY, label: 'Amount From', container: 'filters' });
    const amountTo = form.addField({ id: 'custpage_amount_to', type: serverWidget.FieldType.CURRENCY, label: 'Amount To', container: 'filters' });

    const revenueStatus = form.addField({ id: 'custpage_revenue_status', type: serverWidget.FieldType.SELECT, label: 'Revenue Status', container: 'filters' });
    revenueStatus.addSelectOption({ value: '', text: '- All -' });
    revenueStatus.addSelectOption({ value: 'A', text: 'Revenue Created - Ready to Post' });
    revenueStatus.addSelectOption({ value: 'B', text: 'Posted' });
    revenueStatus.addSelectOption({ value: 'C', text: 'Voided' });

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

    form.addSubmitButton({ label: 'Search Revenue Transactions' });
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
    sublist.addField({ id: 'custpage_tranid', type: serverWidget.FieldType.TEXT, label: 'Pledge Order' });
    sublist.addField({ id: 'custpage_revenue_txn_id', type: serverWidget.FieldType.TEXT, label: 'Revenue Transaction' });
    sublist.addField({ id: 'custpage_date', type: serverWidget.FieldType.DATE, label: 'Date' });
    sublist.addField({ id: 'custpage_customer', type: serverWidget.FieldType.TEXT, label: 'Constituent' });
    sublist.addField({ id: 'custpage_amount', type: serverWidget.FieldType.CURRENCY, label: 'Amount' });
    sublist.addField({ id: 'custpage_revenue_status', type: serverWidget.FieldType.TEXT, label: 'Revenue Status' });
    sublist.addField({ id: 'custpage_internal_id', type: serverWidget.FieldType.TEXT, label: 'Internal ID' }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });

    let lineNum = 0;
    const processedSOs = new Set();
    const revenueTransactionCache = new Map(); // Cache to avoid repeated loads

    pledgeSearch.run().each(result => {
      if (lineNum >= 1000) return false;

      const soId = result.id;
      if (processedSOs.has(soId)) return true;
      processedSOs.add(soId);

      const revenueTxnId = result.getValue('custbody_pledge_rev_txn_id');
      if (!revenueTxnId) return true; // Skip if no revenue transaction

      // Get revenue transaction status (using cache like pledge pattern)
      let revenueStatus = 'Unknown';
      let revenueStatusText = 'Unknown';
      
      try {
        if (!revenueTransactionCache.has(revenueTxnId)) {
          const revenueRec = record.load({
            type: 'customsale_pledge_revenue_posting',
            id: revenueTxnId,
            isDynamic: false
          });
          const status = revenueRec.getValue('transtatus');
          revenueTransactionCache.set(revenueTxnId, status);
        }
        
        revenueStatus = revenueTransactionCache.get(revenueTxnId);
        
        // Convert status codes to readable text
        switch (revenueStatus) {
          case 'A': revenueStatusText = 'Revenue Created - Ready to Post'; break;
          case 'B': revenueStatusText = 'Posted'; break;
          case 'C': revenueStatusText = 'Voided'; break;
          default: revenueStatusText = 'Unknown (' + revenueStatus + ')';
        }
      } catch (e) {
        log.error('Error loading revenue transaction', { 
          revenueTxnId: revenueTxnId, 
          error: e.toString() 
        });
        revenueStatusText = 'Error Loading';
      }

      // Filter by revenue status if specified
      const filterStatus = params.custpage_revenue_status;
      if (filterStatus && filterStatus !== revenueStatus) return true;

      const transactionName = result.getValue('transactionname') || `SO-${soId}`;
      const pledgeOrderUrl = `https://5411584-sb1.app.netsuite.com/app/accounting/transactions/salesord.nl?id=${soId}&whence=`;
      const revenueUrl = `https://5411584-sb1.app.netsuite.com/app/accounting/transactions/cutrsale.nl?id=${revenueTxnId}&customtype=110&whence=`;

      // Use exact pattern from working bulk pledge order
      sublist.setSublistValue({ 
        id: 'custpage_tranid', 
        line: lineNum, 
        value: `<a href="${pledgeOrderUrl}" target="_blank">${transactionName}</a>` 
      });

      sublist.setSublistValue({
        id: 'custpage_revenue_txn_id',
        line: lineNum,
        value: `<a href="${revenueUrl}" target="_blank">Rev-${revenueTxnId}</a>`
      });

      sublist.setSublistValue({ id: 'custpage_date', line: lineNum, value: result.getValue('trandate') || '' });
      sublist.setSublistValue({ id: 'custpage_customer', line: lineNum, value: result.getText('entity') || 'Unknown Constituent' });
      sublist.setSublistValue({ id: 'custpage_amount', line: lineNum, value: result.getValue('total') || 0 });
      sublist.setSublistValue({ id: 'custpage_revenue_status', line: lineNum, value: revenueStatusText });
      sublist.setSublistValue({ id: 'custpage_internal_id', line: lineNum, value: soId });
      
      lineNum++;
      return true;
    });

    if (lineNum > 0) {
      form.addFieldGroup({ id: 'actions', label: `Bulk Actions (${lineNum} records found)` });
      form.addButton({ id: 'custpage_mark_all', label: 'Mark All', functionName: 'markAll()' });
      form.addButton({ id: 'custpage_unmark_all', label: 'Unmark All', functionName: 'unmarkAll()' });
      form.addButton({ id: 'custpage_bulk_post', label: 'Post Revenue Transactions', functionName: 'bulkAction("post")' });
      form.addButton({ id: 'custpage_bulk_void', label: 'Void Revenue Transactions', functionName: 'bulkAction("void")' });
      form.addButton({ id: 'custpage_bulk_cancel', label: 'Cancel Revenue Transactions', functionName: 'bulkAction("cancel")' });

      const script = runtime.getCurrentScript();
      const clientScriptId = script.getParameter('custscript_bulk_revenue_client_script_id');
      if (clientScriptId) form.clientScriptFileId = parseInt(clientScriptId, 10);
      else form.clientScriptModulePath = './bulk_revenue_trans_client.js';
    } else {
      form.addPageInitMessage({
        type: 'WARNING',
        title: 'No Records Found',
        message: 'No revenue transactions match your current search criteria. Try adjusting your filters.',
        duration: 0
      });
    }
  }

  function buildSearchFilters(params) {
    const filters = [
      ['custbody_npo_pledge_promise', 'is', 'T'],
      'AND',
      ['custbody_pledge_rev_txn_id', 'isnotempty', '']
    ];
    
    if (params.custpage_date_from) filters.push('AND', ['trandate', 'onorafter', params.custpage_date_from]);
    if (params.custpage_date_to) filters.push('AND', ['trandate', 'onorbefore', params.custpage_date_to]);
    if (params.custpage_amount_from) filters.push('AND', ['formulanumeric: {total}', 'greaterthanorequalto', params.custpage_amount_from]);
    if (params.custpage_amount_to) filters.push('AND', ['formulanumeric: {total}', 'lessthanorequalto', params.custpage_amount_to]);
    if (params.custpage_customer) filters.push('AND', ['entity', 'anyof', params.custpage_customer]);
    return filters;
  }

  function processBulkAction(context) {
    // Copy exact pattern from working bulk pledge order
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
      // Build redirect URL manually (exact pattern)
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
      // Use your existing library functions directly
      let results;
      switch (action) {
        case 'post':
          results = revenueLib.bulkPostRevenueForPledgeOrders(selectedIds);
          break;
        case 'void':
          results = bulkVoidRevenueForPledgeOrders(selectedIds);
          break;
        case 'cancel':
          results = bulkCancelRevenueForPledgeOrders(selectedIds);
          break;
        default:
          throw new Error('Invalid action: ' + action);
      }
      
      // Build redirect URL manually (exact pattern)
      let redirectUrl = `?`;
      for (let param in context.request.parameters) {
        if (param !== 'action' && param !== 'selected_ids') {
          redirectUrl += `${param}=${encodeURIComponent(context.request.parameters[param])}&`;
        }
      }
      redirectUrl += `last_action=${encodeURIComponent(action)}&processing_results=${encodeURIComponent(JSON.stringify(results))}`;
      
      context.response.sendRedirect({
        type: 'SUITELET',
        identifier: runtime.getCurrentScript().id,
        id: runtime.getCurrentScript().deploymentId,
        parameters: redirectUrl
      });

    } catch (e) {
      log.error('Bulk Processing Failed', e.toString());
      
      // Build error redirect URL manually (exact pattern)
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

  // Helper functions using your library (fixed to use existing functions)
  function bulkPostRevenueForPledgeOrders(soIds) {
    const results = { success: 0, failed: 0, errors: [] };

    soIds.forEach(soId => {
      try {
        // Use the existing function from your library if it exists
        if (revenueLib.postRevenueForPledgeOrder) {
          const result = revenueLib.postRevenueForPledgeOrder(soId);
          if (!result.success) {
            throw new Error(result.error || 'Unknown error');
          }
        } else {
          // Fallback: get revenue transaction ID and call postRevenue directly
          const soRec = record.load({ 
            type: record.Type.SALES_ORDER, 
            id: soId,
            isDynamic: false
          });
          
          const revenueTxnId = soRec.getValue({ fieldId: 'custbody_pledge_rev_txn_id' });
          
          if (!revenueTxnId) {
            throw new Error('No revenue transaction found');
          }

          const result = revenueLib.postRevenue(revenueTxnId);
          if (!result.success) {
            throw new Error(result.error || 'Unknown error');
          }
        }
        results.success++;
      } catch (e) {
        results.failed++;
        results.errors.push(`SO ${soId}: ${e.message}`);
      }
    });

    return results;
  }

  function bulkVoidRevenueForPledgeOrders(soIds) {
    const results = { success: 0, failed: 0, errors: [] };

    soIds.forEach(soId => {
      try {
        // Get revenue transaction ID from SO
        const soRec = record.load({ 
          type: record.Type.SALES_ORDER, 
          id: soId,
          isDynamic: false
        });
        
        const revenueTxnId = soRec.getValue({ fieldId: 'custbody_pledge_rev_txn_id' });
        
        if (!revenueTxnId) {
          throw new Error('No revenue transaction found');
        }

        const result = revenueLib.voidRevenue(revenueTxnId);
        if (!result.success) {
          throw new Error(result.error || 'Unknown error');
        }
        results.success++;
      } catch (e) {
        results.failed++;
        results.errors.push(`SO ${soId}: ${e.message}`);
      }
    });

    return results;
  }

  function bulkCancelRevenueForPledgeOrders(soIds) {
    const results = { success: 0, failed: 0, errors: [] };

    soIds.forEach(soId => {
      try {
        // Get revenue transaction ID from SO
        const soRec = record.load({ 
          type: record.Type.SALES_ORDER, 
          id: soId,
          isDynamic: false
        });
        
        const revenueTxnId = soRec.getValue({ fieldId: 'custbody_pledge_rev_txn_id' });
        
        if (!revenueTxnId) {
          throw new Error('No revenue transaction found');
        }

        const result = revenueLib.cancelRevenue(revenueTxnId);
        if (!result.success) {
          throw new Error(result.error || 'Unknown error');
        }
        results.success++;
      } catch (e) {
        results.failed++;
        results.errors.push(`SO ${soId}: ${e.message}`);
      }
    });

    return results;
  }

  return { onRequest };
});