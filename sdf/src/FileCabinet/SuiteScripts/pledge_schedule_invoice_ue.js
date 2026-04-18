/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @description Pledge Schedule UE — keeps UI and guarantees Remaining on save
 */
define(['N/runtime','N/log'], function(runtime, log){

  function beforeLoad(context){
    if (context.type !== context.UserEventType.VIEW) return;

    var rec  = context.newRecord;
    var form = context.form;

    try{
      var isBilled       = rec.getValue('custrecord_isbilled');
      var linkedInvoice  = rec.getValue('custrecord_po_invoice');
      var linkedOrder    = rec.getValue('custrecord_linked_pledge_order');
      var instDate       = rec.getValue('custrecord_ps_installment_date');

      if (linkedOrder && !isBilled && !linkedInvoice){
        form.addButton({ id:'custpage_create_invoice', label:'Create Invoice', functionName:'createInvoice' });
        var csId = runtime.getCurrentScript().getParameter('custscript_schedule_client_id');
        if (csId) form.clientScriptFileId = parseInt(csId,10);
        else form.clientScriptModulePath = './pledge_schedule_invoice_client.js';

        // Messaging
        var today = new Date();
        var d = instDate ? new Date(instDate) : null;
        if (d && d <= today){
          form.addPageInitMessage({ type:'CONFIRMATION', title:'Ready for Invoicing', message:'This installment is due and ready for invoice creation.', duration:0 });
        } else if (d) {
          form.addPageInitMessage({ type:'WARNING', title:'Not Yet Due', message:'This installment is not yet due ('+instDate+').', duration:0 });
        }
      } else if (isBilled || linkedInvoice){
        form.addPageInitMessage({ type:'INFORMATION', title:'Already Billed', message:'This installment has already been invoiced.', duration:0 });
      } else if (!linkedOrder){
        form.addPageInitMessage({ type:'ERROR', title:'Missing Pledge Order', message:'This schedule is not linked to a pledge order.', duration:0 });
      }
    } catch(e){
      log.error('PS-SCHEDULE beforeLoad', { id: rec.id, error: e.message });
    }
  }

  // Guarantee Remaining on *any* save of the schedule itself
  function beforeSubmit(context){
    if (context.type === context.UserEventType.XEDIT) return;
    try{
      var r       = context.newRecord;
      var install = Number(r.getValue('custrecord_ps_installment_amt') || 0);
      var paidVal = r.getValue('custrecord_ps_payments');
      var paid    = (paidVal === '' || paidVal == null) ? 0 : Number(paidVal);
      var remaining = install - paid; // number
      r.setValue({ fieldId:'custrecord_installment_amt_remaining', value: remaining });
      log.debug('PS-SCHEDULE: set remaining in beforeSubmit', { id:r.id, install:install, paid:paid, remaining:remaining });
    }catch(e){
      log.error('PS-SCHEDULE beforeSubmit error', { id: context.newRecord.id, error:e.message });
    }
  }

  return { beforeLoad: beforeLoad, beforeSubmit: beforeSubmit };
});
