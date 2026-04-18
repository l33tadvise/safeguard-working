/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * 
 * SO REVENUE CREATION SUITELET
 * Handles creating revenue postings from Sales Orders
 */
define(['N/record', 'N/log'], (record, log) => {

  
  function onRequest(context) {
    if (context.request.method === 'GET') {
      const soId = context.request.parameters.soId;
      
      if (!soId) {
        context.response.write(JSON.stringify({
          success: false,
          error: 'Missing Sales Order ID'
        }));
        return;
      }
      
      try {
        // Create the revenue posting
        const result = createRevenuePosting(soId);
        
        context.response.write(JSON.stringify({
          success: true,
          revenuePostingId: result.revenuePostingId,
          message: `Revenue posting ${result.revenuePostingId} created successfully`
        }));
        
      } catch (e) {
        log.error('Revenue Creation Failed', e.toString());
        context.response.write(JSON.stringify({
          success: false,
          error: e.message
        }));
      }
    }
  }
  
  function createRevenuePosting(soId) {
    // Load the SO
    const soRec = record.load({
      type: record.Type.SALES_ORDER,
      id: soId,
      isDynamic: true
    });
    
    // Validate
    const isPledge = soRec.getValue({ fieldId: 'custbody_npo_pledge_promise' });
    if (!isPledge) {
      throw new Error('Not an unconditional pledge');
    }
    
    const alreadyPosted = soRec.getValue({ fieldId: 'custbody_pledge_rev_posted' });
    if (alreadyPosted) {
      throw new Error('Revenue already posted');
    }
    
    // Create revenue posting
    const revenueRec = record.create({
      type: 'customsale_pledge_revenue_posting',
      isDynamic: true
    });
    
    // Copy header fields
    revenueRec.setValue({ fieldId: 'entity', value: soRec.getValue({ fieldId: 'entity' }) });
    revenueRec.setValue({ fieldId: 'subsidiary', value: soRec.getValue({ fieldId: 'subsidiary' }) });
    revenueRec.setValue({ fieldId: 'currency', value: soRec.getValue({ fieldId: 'currency' }) });
    revenueRec.setValue({ fieldId: 'trandate', value: soRec.getValue({ fieldId: 'trandate' }) });

    // Force account to 1221 for testing
    revenueRec.setValue({ fieldId: 'account', value: 741 });
    
    // Set custom fields
    revenueRec.setValue({ fieldId: 'custbody_source_pledge_order', value: soId });
    revenueRec.setValue({ fieldId: 'custbody_locked_transaction', value: true });
    revenueRec.setValue({ fieldId: 'transtatus', value: 'A' });
    
    // Set memo
    const memo = `Revenue posting for Pledge Order ${soRec.getValue({ fieldId: 'tranid' })}`;
    revenueRec.setValue({ fieldId: 'memo', value: memo });
    
    // Copy line items
    const lineCount = soRec.getLineCount({ sublistId: 'item' });
    for (let i = 0; i < lineCount; i++) {
      revenueRec.selectNewLine({ sublistId: 'item' });
      
      revenueRec.setCurrentSublistValue({ 
        sublistId: 'item', 
        fieldId: 'item', 
        value: soRec.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i })
      });
      revenueRec.setCurrentSublistValue({ 
        sublistId: 'item', 
        fieldId: 'quantity', 
        value: soRec.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i }) || 1
      });
      revenueRec.setCurrentSublistValue({ 
        sublistId: 'item', 
        fieldId: 'amount', 
        value: soRec.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: i })
      });
      
      // Copy classifications
      ['department', 'class', 'location', 'cseg_npo_restrictn', 'cseg_npo_fund_p'].forEach(field => {
        const val = soRec.getSublistValue({ sublistId: 'item', fieldId: field, line: i });
        if (val) {
          try {
            revenueRec.setCurrentSublistValue({ sublistId: 'item', fieldId: field, value: val });
          } catch (e) {
            // Skip if field doesn't exist
          }
        }
      });
      
      revenueRec.commitLine({ sublistId: 'item' });
    }
    
    // Save revenue posting
    const revenuePostingId = revenueRec.save();
    
    // Update SO
    record.submitFields({
      type: record.Type.SALES_ORDER,
      id: soId,
      values: {
        custbody_pledge_rev_posted: true,
        custbody_pledge_rev_txn_id: revenuePostingId,
        custbody_pledge_rev_amount: soRec.getValue({ fieldId: 'total' })
      }
    });
    
    log.audit('Revenue Posting Created', {
      soId: soId,
      revenuePostingId: revenuePostingId
    });
    
    return { revenuePostingId: revenuePostingId };
  }
  
  return {
    onRequest: onRequest
  };
});