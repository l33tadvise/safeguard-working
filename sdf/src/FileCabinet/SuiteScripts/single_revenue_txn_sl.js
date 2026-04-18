/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * 
 * REVENUE POSTING OPERATIONS SUITELET
 * Handles post/void/cancel operations on revenue postings
 */
define(['N/record', 'N/log', 'N/runtime'], (record, log, runtime) => {

  function onRequest(context) {
    if (context.request.method === 'GET') {
      const action = context.request.parameters.action;
      const txnId = context.request.parameters.txnId;
      
      if (!action || !txnId) {
        context.response.write(JSON.stringify({
          success: false,
          error: 'Missing action or transaction ID'
        }));
        return;
      }
      
      try {
        let result;
        
        switch (action) {
          case 'post':
            result = postRevenue(txnId);
            break;
          case 'void':
            result = voidRevenue(txnId);
            break;
          case 'cancel':
            result = cancelRevenue(txnId);
            break;
          default:
            throw new Error('Invalid action: ' + action);
        }
        
        context.response.write(JSON.stringify({
          success: true,
          message: result.message,
          redirectUrl: result.redirectUrl
        }));
        
      } catch (e) {
        log.error('Revenue Operation Failed', {
          action: action,
          txnId: txnId,
          error: e.toString()
        });
        
        context.response.write(JSON.stringify({
          success: false,
          error: e.message
        }));
      }
    }
  }
  
  function postRevenue(txnId) {
    // Load record to get details for audit
    const revenueRec = record.load({
      type: 'customsale_pledge_revenue_posting',
      id: txnId
    });
    
    const sourceSO = revenueRec.getValue({ fieldId: 'custbody_source_pledge_order' });
    
    // Change status to Revenue Posted
    record.submitFields({
      type: 'customsale_pledge_revenue_posting',
      id: txnId,
      values: {
        transtatus: 'B'
      }
    });
    
    // NOW set the SO posted flag to TRUE
    if (sourceSO) {
      record.submitFields({
        type: record.Type.SALES_ORDER,
        id: sourceSO,
        values: {
          custbody_pledge_rev_posted: true
        }
      });
    }
    
    log.audit('Revenue Posted', { txnId: txnId });
    
    // Enhanced audit trail
    log.audit('REVENUE_POSTING_POSTED', {
      timestamp: new Date(),
      userId: runtime.getCurrentUser().id,
      userName: runtime.getCurrentUser().name,
      revenuePostingId: txnId,
      sourceSO: sourceSO,
      amount: revenueRec.getValue({ fieldId: 'total' }),
      currency: revenueRec.getValue({ fieldId: 'currency' }),
      customer: revenueRec.getValue({ fieldId: 'entity' }),
      businessJustification: 'Revenue posting approved and posted'
    });
    
    return {
      message: 'Revenue posted successfully',
      redirectUrl: `/app/accounting/transactions/cutrsale.nl?customtype=110&id=${txnId}`
    };
  }
  
  function voidRevenue(txnId) {
    // Load the revenue posting
    const revenueRec = record.load({
      type: 'customsale_pledge_revenue_posting',
      id: txnId
    });
    
    const sourceSO = revenueRec.getValue({ fieldId: 'custbody_source_pledge_order' });
    
    // Set void status
    record.submitFields({
      type: 'customsale_pledge_revenue_posting',
      id: txnId,
      values: {
        transtatus: 'C',
        custbody_void_trigger: true
      }
    });
    
    // Clear SO fields
    if (sourceSO) {
      record.submitFields({
        type: record.Type.SALES_ORDER,
        id: sourceSO,
        values: {
          custbody_pledge_rev_posted: false,
          custbody_pledge_rev_txn_id: '',
          custbody_pledge_rev_amount: 0
        }
      });
    }
    
    log.audit('Revenue Voided', { 
      txnId: txnId,
      sourceSO: sourceSO 
    });
    
    // Enhanced audit trail
    log.audit('REVENUE_POSTING_VOIDED', {
      timestamp: new Date(),
      userId: runtime.getCurrentUser().id,
      userName: runtime.getCurrentUser().name,
      revenuePostingId: txnId,
      sourceSO: sourceSO,
      amount: revenueRec.getValue({ fieldId: 'total' }),
      currency: revenueRec.getValue({ fieldId: 'currency' }),
      customer: revenueRec.getValue({ fieldId: 'entity' }),
      businessJustification: 'Revenue posting voided - reversing revenue recognition'
    });
    
    return {
      message: 'Revenue posting voided successfully',
      redirectUrl: `/app/accounting/transactions/cutrsale.nl?customtype=110&id=${txnId}`
    };
  }
  
  function cancelRevenue(txnId) {
    // Load the revenue posting
    const revenueRec = record.load({
      type: 'customsale_pledge_revenue_posting',
      id: txnId
    });
    
    const sourceSO = revenueRec.getValue({ fieldId: 'custbody_source_pledge_order' });
    
    // Clear SO fields first
    if (sourceSO) {
      record.submitFields({
        type: record.Type.SALES_ORDER,
        id: sourceSO,
        values: {
          custbody_pledge_rev_posted: false,
          custbody_pledge_rev_txn_id: '',
          custbody_pledge_rev_amount: 0
        }
      });
    }
    
    // Delete the revenue posting
    record.delete({
      type: 'customsale_pledge_revenue_posting',
      id: txnId
    });
    
    log.audit('Revenue Canceled', { 
      txnId: txnId,
      sourceSO: sourceSO 
    });
    
    // Enhanced audit trail
    log.audit('REVENUE_POSTING_CANCELED', {
      timestamp: new Date(),
      userId: runtime.getCurrentUser().id,
      userName: runtime.getCurrentUser().name,
      revenuePostingId: txnId,
      sourceSO: sourceSO,
      amount: revenueRec.getValue({ fieldId: 'total' }),
      currency: revenueRec.getValue({ fieldId: 'currency' }),
      customer: revenueRec.getValue({ fieldId: 'entity' }),
      businessJustification: 'Revenue posting canceled before posting - no revenue impact'
    });
    
    return {
      message: 'Revenue posting canceled successfully',
      redirectUrl: sourceSO ? `/app/accounting/transactions/salesord.nl?id=${sourceSO}` : '/app/center/card.nl?sc=-29'
    };
  }
  
  return {
    onRequest: onRequest
  };
});