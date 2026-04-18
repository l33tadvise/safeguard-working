/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * 
 * THIN REVENUE POSTING CLIENT SCRIPT - Just calls Suitelet
 */
define(['N/currentRecord', 'N/ui/message', 'N/url', 'N/https'], 
  (currentRecord, message, url, https) => {
  
  function pageInit(context) {
    window.postRevenue = postRevenue;
    window.voidTransaction = voidTransaction;
    window.cancelRevenuePosting = cancelRevenuePosting;
  }
  
  function callSuitelet(action, confirmMsg, successMsg) {
    try {
      const rec = currentRecord.get();
      const txnId = rec.id;
      
      if (!confirm(confirmMsg)) return;
      
      const processingMsg = message.create({
        title: 'Processing',
        message: 'Processing...',
        type: message.Type.INFORMATION
      });
      processingMsg.show();
      
      const suiteletUrl = url.resolveScript({
        scriptId: 'customscript_single_revenue_ops_sl',
        deploymentId: 'customdeploy_single_revenue_ops_sl',
        params: { action: action, txnId: txnId }
      });
      
      const response = https.get({ url: suiteletUrl });
      const result = JSON.parse(response.body);
      
      processingMsg.hide();
      
      if (result.success) {
        message.create({
          title: 'Success',
          message: result.message,
          type: message.Type.CONFIRMATION
        }).show({ duration: 3000 });
        
        // Add longer delay for cancel operation to let SO update properly
        const delay = action === 'cancel' ? 3000 : 1500;
        
        setTimeout(() => {
          try {
            window.location.href = result.redirectUrl;
          } catch (e) {
            // Fallback - just close the window if redirect fails
            window.close();
          }
        }, delay);
      } else {
        throw new Error(result.error);
      }
      
    } catch (e) {
      message.create({
        title: 'Error',
        message: `Failed: ${e.message}`,
        type: message.Type.ERROR
      }).show({ duration: 8000 });
    }
  }
  
  function postRevenue() {
    callSuitelet('post', 
      'Post this revenue?', 
      'Revenue posted successfully');
  }
  
  function voidTransaction() {
    callSuitelet('void', 
      'Void this revenue posting? This will clear the source Pledge Order.', 
      'Revenue posting voided successfully');
  }
  
  function cancelRevenuePosting() {
    callSuitelet('cancel', 
      'Cancel this revenue posting? This will delete it and unlock the source Pledge Order.', 
      'Revenue posting canceled successfully');
  }
  
  return {
    pageInit: pageInit,
    postRevenue: postRevenue,
    voidTransaction: voidTransaction,
    cancelRevenuePosting: cancelRevenuePosting
  };
});