/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * 
 * SIMPLIFIED REVENUE POSTING SCRIPT
 * Core focus: Status management and SO sync
 */
define(['N/record', 'N/error', 'N/runtime'], (record, error, runtime) => {

  function beforeLoad(context) {
    if (context.type !== context.UserEventType.VIEW && context.type !== context.UserEventType.EDIT) {
      return;
    }
    
    const form = context.form;
    const status = context.newRecord.getValue({ fieldId: 'transtatus' });
    
    // Clean up standard buttons
    try {
      form.removeButton({ id: 'makecopy' });
      form.removeButton({ id: 'delete' });
      form.removeButton({ id: 'edit' }); // Remove Edit button - use workflow buttons only
    } catch (e) {
      // Buttons might not exist
    }
    
    // Add status-specific buttons and messages
    switch (status) {
      case 'A': // Pending Approval
        form.addButton({
          id: 'custpage_post_revenue',
          label: 'Post Revenue',
          functionName: 'postRevenue'
        });
        
        // Add CANCEL button for pending approval status
        form.addButton({
          id: 'custpage_cancel_revenue_posting',
          label: 'Delete Revenue Transaction',
          functionName: 'cancelRevenuePosting'
        });
        
        form.addPageInitMessage({
          type: 'INFORMATION',
          title: 'Pending Approval',
          message: 'You can post this revenue or cancel it to unlock the source Pledge Order for editing.',
          duration: 0
        });
        break;
        
      case 'B': // Revenue Posted
        form.addButton({
          id: 'custpage_void_transaction',
          label: 'Void Transaction',
          functionName: 'voidTransaction'
        });
        form.addPageInitMessage({
          type: 'CONFIRMATION',
          title: 'Revenue Posted',
          message: 'This revenue has been posted and is synced with the source Sales Order.',
          duration: 0
        });
        break;
        
      case 'C': // Voided
        form.addPageInitMessage({
          type: 'WARNING',
          title: 'Transaction Voided',
          message: 'This transaction has been voided and removed from the source Sales Order.',
          duration: 0
        });
        break;
    }
    
    // Set client script
    const scriptObj = runtime.getCurrentScript();
    const clientScriptId = scriptObj.getParameter({ name: 'custscript_client_script_id' });
    if (clientScriptId) {
      form.clientScriptFileId = parseInt(clientScriptId);
    }
  }

  function beforeSubmit(context) {
    // Only process edits and prevent unauthorized changes
    if (context.type !== context.UserEventType.EDIT) {
      return;
    }
    
    const newRecord = context.newRecord;
    const oldRecord = context.oldRecord;
    
    // Check if this is a locked transaction
    const isLocked = newRecord.getValue({ fieldId: 'custbody_locked_transaction' });
    if (!isLocked) {
      return; // Not locked, allow all changes
    }
    
    // For locked transactions, only allow status changes
    const oldStatus = oldRecord.getValue({ fieldId: 'transtatus' });
    const newStatus = newRecord.getValue({ fieldId: 'transtatus' });
    
    // Allow status changes (approval workflow)
    if (oldStatus !== newStatus) {
      log.audit('Status Change Allowed', {
        from: oldStatus,
        to: newStatus,
        txnId: newRecord.id
      });
      return;
    }
    
    // Block all other changes on locked transactions
    throw error.create({
      name: 'LOCKED_TRANSACTION',
      message: 'This revenue posting is locked. Changes must be made on the source Sales Order.',
      notifyOff: false
    });
  }

  function afterSubmit(context) {
    if (context.type !== context.UserEventType.EDIT) {
      return;
    }
    
    const newRecord = context.newRecord;
    const oldRecord = context.oldRecord;
    
    // Handle void synchronization
    const oldStatus = oldRecord.getValue({ fieldId: 'transtatus' });
    const newStatus = newRecord.getValue({ fieldId: 'transtatus' });
    
    // Check if transaction was voided
    if (newStatus === 'C' && oldStatus !== 'C') {
      syncVoidToSalesOrder(newRecord);
    }
    
    // Check for workflow void trigger
    const oldTrigger = oldRecord.getValue({ fieldId: 'custbody_void_trigger' });
    const newTrigger = newRecord.getValue({ fieldId: 'custbody_void_trigger' });
    
    if (!oldTrigger && newTrigger) {
      syncVoidToSalesOrder(newRecord);
    }
  }

  function beforeDelete(context) {
    const customTxn = context.oldRecord;
    syncDeleteToSalesOrder(customTxn);
  }

  // Helper Functions
  function syncVoidToSalesOrder(revenueRecord) {
    const sourceSO = revenueRecord.getValue({ fieldId: 'custbody_source_pledge_order' });
    if (!sourceSO) return;
    
    try {
      record.submitFields({
        type: record.Type.SALES_ORDER,
        id: sourceSO,
        values: {
          custbody_pledge_rev_posted: false,
          custbody_pledge_rev_txn_id: '',
          custbody_pledge_rev_amount: 0
        }
      });
      
      log.audit('SO Updated - Void Sync', {
        salesOrderId: sourceSO,
        voidedTxnId: revenueRecord.id
      });
      
    } catch (e) {
      log.error('Failed to sync void to SO', {
        error: e.toString(),
        salesOrderId: sourceSO,
        txnId: revenueRecord.id
      });
    }
  }
  
  function syncDeleteToSalesOrder(revenueRecord) {
    const sourceSO = revenueRecord.getValue({ fieldId: 'custbody_source_pledge_order' });
    if (!sourceSO) return;
    
    try {
      record.submitFields({
        type: record.Type.SALES_ORDER,
        id: sourceSO,
        values: {
          custbody_pledge_rev_posted: false,
          custbody_pledge_rev_txn_id: '',
          custbody_pledge_rev_amount: 0
        }
      });
      
      log.audit('SO Updated - Delete Sync', {
        salesOrderId: sourceSO,
        deletedTxnId: revenueRecord.id
      });
      
    } catch (e) {
      log.error('Failed to sync delete to SO', {
        error: e.toString(),
        salesOrderId: sourceSO,
        txnId: revenueRecord.id
      });
    }
  }

  return {
    beforeLoad: beforeLoad,
    beforeSubmit: beforeSubmit,
    afterSubmit: afterSubmit,
    beforeDelete: beforeDelete
  };
});