/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * 
 * THIN SO CLIENT SCRIPT - Just calls Suitelet
 */
define(['N/currentRecord', 'N/ui/message', 'N/url', 'N/https', 'N/record'], 
  (currentRecord, message, url, https, record) => {
  
  function pageInit(context) {
    window.createRevenuePosting = createRevenuePosting;
    window.holdRevenue = holdRevenue;
    window.releaseRevenueHold = releaseRevenueHold;
  }
  
  function createRevenuePosting() {
    try {
      const rec = currentRecord.get();
      const soId = rec.id;
      
      // Check for revenue hold
      const revenueHold = rec.getValue({ fieldId: 'custbody_revenue_hold' });
      if (revenueHold) {
        message.create({
          title: 'Revenue On Hold',
          message: 'Revenue processing is on hold for this Pledge Order. Release the hold first.',
          type: message.Type.ERROR
        }).show({ duration: 5000 });
        return;
      }
      
      if (!confirm('Create revenue posting for this Pledge Order?')) {
        return;
      }
      
      const processingMsg = message.create({
        title: 'Processing',
        message: 'Creating revenue posting...',
        type: message.Type.INFORMATION
      });
      processingMsg.show();
      
      // Call the Suitelet
      const suiteletUrl = url.resolveScript({
        scriptId: 'customscript_single_so_revenue_sl',
        deploymentId: 'customdeploy_single_so_revenue_sl',
        params: { soId: soId }
      });
      
      const response = https.get({ url: suiteletUrl });
      const result = JSON.parse(response.body);
      
      processingMsg.hide();
      
      if (result.success) {
        message.create({
          title: 'Success',
          message: result.message,
          type: message.Type.CONFIRMATION
        }).show({ duration: 5000 });
        
        setTimeout(() => window.location.reload(), 2000);
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
  
  function holdRevenue() {
    try {
      if (!confirm('Put revenue processing on hold for this Pledge Order?\n\nThis will prevent revenue postings from being created until the hold is released.')) {
        return;
      }
      
      const rec = currentRecord.get();
      const soId = rec.id;
      
      // Set the hold flag
      record.submitFields({
        type: record.Type.SALES_ORDER,
        id: soId,
        values: {
          custbody_revenue_hold: true
        }
      });
      
      message.create({
        title: 'Revenue Hold Applied',
        message: 'Revenue processing is now on hold for this Pledge Order.',
        type: message.Type.CONFIRMATION
      }).show({ duration: 5000 });
      
      setTimeout(() => window.location.reload(), 2000);
      
    } catch (e) {
      message.create({
        title: 'Error',
        message: `Failed to apply revenue hold: ${e.message}`,
        type: message.Type.ERROR
      }).show({ duration: 8000 });
    }
  }
  
  function releaseRevenueHold() {
    try {
      if (!confirm('Release the revenue processing hold for this Pledge Order?\n\nThis will allow revenue postings to be created again.')) {
        return;
      }
      
      const rec = currentRecord.get();
      const soId = rec.id;
      
      // Clear the hold flag
      record.submitFields({
        type: record.Type.SALES_ORDER,
        id: soId,
        values: {
          custbody_revenue_hold: false
        }
      });
      
      message.create({
        title: 'Revenue Hold Released',
        message: 'Revenue processing hold has been released. You can now create revenue postings.',
        type: message.Type.CONFIRMATION
      }).show({ duration: 5000 });
      
      setTimeout(() => window.location.reload(), 2000);
      
    } catch (e) {
      message.create({
        title: 'Error',
        message: `Failed to release revenue hold: ${e.message}`,
        type: message.Type.ERROR
      }).show({ duration: 8000 });
    }
  }
  
  return {
    pageInit: pageInit,
    createRevenuePosting: createRevenuePosting,
    holdRevenue: holdRevenue,
    releaseRevenueHold: releaseRevenueHold
  };
});