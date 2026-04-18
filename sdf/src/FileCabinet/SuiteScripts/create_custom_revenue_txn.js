/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 * 
 * PLEDGE ORDER (SALES ORDER) SCRIPT
 * Handles creation and updates of pledge revenue postings + adds button
 */
define(['N/record', 'N/search', 'N/runtime', 'N/error'], (record, search, runtime, error) => {


  /**
   * Add button to Sales Order forms
   */
  function beforeLoad(context) {
    if (context.type !== context.UserEventType.VIEW && context.type !== context.UserEventType.EDIT) {
      return;
    }
    
    const form = context.form;
    const soRecord = context.newRecord;
    
    // Only add button for pledge orders
    const isPledge = soRecord.getValue({ fieldId: 'custbody_npo_pledge_promise' });
    if (!isPledge) return;
    
    // Check if revenue posting exists (regardless of posted status)
    const revenueExists = soRecord.getValue({ fieldId: 'custbody_pledge_rev_txn_id' });
    const alreadyPosted = soRecord.getValue({ fieldId: 'custbody_pledge_rev_posted' });
    
    // Check revenue hold status
    const revenueHold = soRecord.getValue({ fieldId: 'custbody_revenue_hold' });
    
    // REMOVE EDIT BUTTON IF REVENUE POSTING EXISTS
    if (revenueExists) {
      try {
        form.removeButton({ id: 'edit' });
      } catch (e) {
        // Button might not exist
      }
    }
    
    // Check unconditional promise requirement
    const isUnconditional = soRecord.getValue({ fieldId: 'custbody_npo_pledge_promise' });
    if (!isUnconditional) {
      // Show warning for conditional pledges
      form.addPageInitMessage({
        type: 'WARNING',
        title: 'Conditional Pledge',
        message: 'This is a conditional pledge. Revenue posting cannot be created until the unconditional promise checkbox is marked.',
        duration: 0
      });
      return; // Don't add button for conditional pledges
    }
    
    if (revenueExists && alreadyPosted) {
      // Revenue posted - show posted status with clickable link
      const viewUrl = `/app/accounting/transactions/cutrsale.nl?customtype=110&id=${revenueExists}`;
      
      form.addPageInitMessage({
        type: 'CONFIRMATION',
        title: 'Pledge Order Locked - Revenue Posted',
        message: `This pledge order is locked because revenue has been posted. <a href="${viewUrl}" target="_blank">Click here to view Transaction ${revenueExists}</a><br><br><strong>To modify this Pledge Order:</strong> You must first void the revenue posting transaction, then make your changes to the Pledge Order, and create a new revenue posting.`,
        duration: 0
      });
      
      // NO BUTTONS - revenue is posted
      
    } else if (revenueExists && !alreadyPosted) {
      // Revenue posting created but not yet posted
      const viewUrl = `/app/accounting/transactions/cutrsale.nl?customtype=110&id=${revenueExists}`;
      
      form.addPageInitMessage({
        type: 'WARNING',
        title: 'Pledge Order Locked - Revenue Posting Transaction Created',
        message: `This pledge order is locked because a revenue posting has been created but not yet posted. <a href="${viewUrl}" target="_blank">Click here to view Transaction ${revenueExists}</a><br><br><strong>To modify this Pledge Order:</strong> You must first cancel the revenue posting transaction, then make your changes to the Pledge Order, and create a new revenue posting.`,
        duration: 0
      });
      
      // NO BUTTONS - revenue posting exists in pending state
      
    } else if (revenueHold) {
      // Revenue is on hold - show hold message and release button
      form.addPageInitMessage({
        type: 'WARNING',
        title: 'Revenue Processing On Hold',
        message: 'Revenue processing is currently on hold for this Pledge Order. Use the "Release Revenue Hold" button to enable revenue posting.',
        duration: 0
      });
      
      form.addButton({
        id: 'custpage_release_revenue_hold',
        label: 'Release Revenue Hold',
        functionName: 'releaseRevenueHold'
      });
      
    } else {
      // No revenue posted and no hold - show normal create button and hold option
      form.addButton({
        id: 'custpage_create_revenue_posting',
        label: 'Create Revenue Posting',
        functionName: 'createRevenuePosting'
      });
      
      form.addButton({
        id: 'custpage_hold_revenue',
        label: 'Hold Revenue Processing',
        functionName: 'holdRevenue'
      });
    }
    
    // Set client script
    const scriptObj = runtime.getCurrentScript();
    const clientScriptId = scriptObj.getParameter({ name: 'custscript_so_client_script_id' });
    if (clientScriptId) {
      form.clientScriptFileId = parseInt(clientScriptId);
    }
  }

  function beforeSubmit(context) {
    if (context.type === context.UserEventType.DELETE) return;
    
    const so = context.newRecord;
    const isPledge = so.getValue({ fieldId: 'custbody_npo_pledge_promise' });
    
    if (isPledge) {
      // BLOCK EDITS IF REVENUE IS POSTED
      if (context.type === context.UserEventType.EDIT) {
        const alreadyPosted = so.getValue({ fieldId: 'custbody_pledge_rev_posted' });
        if (alreadyPosted) {
          throw error.create({
            name: 'LOCKED_RECORD',
            message: 'This Sales Order is locked because revenue has been posted. Use the revenue posting transaction to make changes.',
            notifyOff: false
          });
        }
      }
    }
  }

  function afterSubmit(context) {
    if (context.type !== context.UserEventType.EDIT) return;

    const so = context.newRecord;
    const soId = so.id;
    
    const isPledge = so.getValue({ fieldId: 'custbody_npo_pledge_promise' });
    if (!isPledge) return;

    const alreadyPosted = so.getValue({ fieldId: 'custbody_pledge_rev_posted' });
    const revTxnId = so.getValue({ fieldId: 'custbody_pledge_rev_txn_id' });

    // ONLY handle voiding/deletion on status changes - NO AUTOMATIC CREATION
    if (alreadyPosted && revTxnId) {
      const status = so.getValue({ fieldId: 'orderstatus' });
      if (status === 'C' || status === 'H') {
        try {
          record.delete({
            type: 'customsale_pledge_revenue_posting',
            id: parseInt(revTxnId)
          });

          record.submitFields({
            type: record.Type.SALES_ORDER,
            id: soId,
            values: {
              custbody_pledge_rev_posted: false,
              custbody_pledge_rev_txn_id: '',
              custbody_pledge_rev_amount: 0
            }
          });

          log.audit('Voided Pledge Revenue', `Deleted transaction ${revTxnId} due to SO status change`);
        } catch (e) {
          log.error('Void Failed', e.toString());
        }
      }
    }
  }

  return { 
    beforeLoad: beforeLoad,
    beforeSubmit: beforeSubmit,
    afterSubmit: afterSubmit 
  };
});