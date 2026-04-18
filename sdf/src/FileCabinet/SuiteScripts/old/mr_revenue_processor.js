/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * 
 * MAP/REDUCE REVENUE PROCESSOR
 * Processes bulk revenue creation by calling existing revenue suitelet
 */
define(['N/record', 'N/log', 'N/url', 'N/http', 'N/runtime'], 
(record, log, url, http, runtime) => {

  function getInputData() {
    // Get the parameters passed from the bulk processing suitelet
    const script = runtime.getCurrentScript();
    const selectedIds = JSON.parse(script.getParameter('custscript_selected_so_ids') || '[]');
    const action = script.getParameter('custscript_bulk_action') || 'create';
    
    log.audit('Map/Reduce Started', {
      selectedIds: selectedIds,
      action: action,
      count: selectedIds.length
    });
    
    // Return array of objects for processing
    return selectedIds.map(soId => ({
      soId: soId,
      action: action
    }));
  }
  
  function map(context) {
    let data;
    try {
      data = JSON.parse(context.value);
      const soId = data.soId;
      const action = data.action;
      
      log.debug('Processing SO', `SO ${soId} - Action: ${action}`);
      
      let result;
      
      switch (action) {
        case 'create':
          result = createRevenueForSO(soId);
          break;
        case 'hold':
          result = applyHoldToSO(soId);
          break;
        case 'release':
          result = releaseHoldFromSO(soId);
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }
      
      log.debug('Success Result', `SO ${soId}: ${JSON.stringify(result)}`);
      
      // Write success result
      context.write({
        key: 'success',
        value: {
          soId: soId,
          action: action,
          result: result,
          timestamp: new Date()
        }
      });
      
    } catch (e) {
      log.error('Map Processing Failed', `SO ${data ? data.soId : 'unknown'}: ${e.message}`);
      log.error('Full Error Details', e.toString());
      
      // Write error result
      context.write({
        key: 'error',
        value: {
          soId: data ? data.soId : 'unknown',
          action: data ? data.action : 'unknown',
          error: e.message,
          fullError: e.toString(),
          timestamp: new Date()
        }
      });
    }
  }
  
  function reduce(context) {
    const key = context.key; // 'success' or 'error'
    const values = context.values;
    
    // Aggregate results
    const results = values.map(value => JSON.parse(value));
    
    log.audit(`${key.toUpperCase()} Results`, {
      count: results.length,
      details: results
    });
    
    // Write summary
    context.write({
      key: key,
      value: {
        count: results.length,
        results: results
      }
    });
  }
  
  function summarize(context) {
    let successCount = 0;
    let errorCount = 0;
    let errors = [];
    
    // Process results
    context.output.iterator().each((key, value) => {
      const data = JSON.parse(value);
      
      if (key === 'success') {
        successCount = data.count;
      } else if (key === 'error') {
        errorCount = data.count;
        errors = data.results.map(r => `SO ${r.soId}: ${r.error}`);
      }
      
      return true;
    });
    
    // Log final summary
    log.audit('Bulk Processing Complete', {
      successCount: successCount,
      errorCount: errorCount,
      totalProcessed: successCount + errorCount,
      errors: errors
    });
    
    // Optional: Create a summary record or send notification
    // You could create a custom record to track bulk processing results
  }
  
  function createRevenueForSO(soId) {
    try {
      log.debug('Starting Revenue Creation', `SO ${soId}`);
      
      // Call your existing revenue creation suitelet
      const suiteletUrl = url.resolveScript({
        scriptId: 'customscript_so_revenue_sl',
        deploymentId: 'customdeploy_so_revenue_sl',
        params: { soId: soId }
      });
      
      log.debug('Suitelet URL', suiteletUrl);
      
      const response = http.get({ url: suiteletUrl });
      
      log.debug('HTTP Response', `Status: ${response.code}, Body: ${response.body}`);
      
      const result = JSON.parse(response.body);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      log.debug('Revenue Created', `SO ${soId} -> Revenue ${result.revenuePostingId}`);
      return result;
      
    } catch (e) {
      log.error('Revenue Creation Error', `SO ${soId}: ${e.message}`);
      throw e;
    }
  }
  
  function applyHoldToSO(soId) {
    record.submitFields({
      type: record.Type.SALES_ORDER,
      id: soId,
      values: {
        custbody_revenue_hold: true
      }
    });
    
    log.debug('Hold Applied', `SO ${soId}`);
    return { success: true, message: 'Hold applied' };
  }
  
  function releaseHoldFromSO(soId) {
    record.submitFields({
      type: record.Type.SALES_ORDER,
      id: soId,
      values: {
        custbody_revenue_hold: false
      }
    });
    
    log.debug('Hold Released', `SO ${soId}`);
    return { success: true, message: 'Hold released' };
  }
  
  return {
    getInputData: getInputData,
    map: map,
    reduce: reduce,
    summarize: summarize
  };
});