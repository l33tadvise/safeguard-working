/**
 * Pledge Order – Create Scheduled Invoices  (13-Jun-2025)
 *
 * @NApiVersion 2.1
 * @NScriptType  ClientScript
 */
define(['N/currentRecord','N/ui/dialog','N/url','N/https','N/ui/message'],
function(currentRecord,dialog,url,https,message){

  var processingMsg=null;

  /* ---------- success banner on page load ---------- */
  function pageInit(){
    var p=new URLSearchParams(window.location.search);
    if(p.has('invCount')){
      message.create({
        title:'Invoices Created',
        message:'Successfully created '+p.get('invCount')+
                ' invoice'+(p.get('invCount')>1?'s':'')+
                ' – total $'+p.get('invTotal')+'.',
        type:message.Type.CONFIRMATION
      }).show({duration:6000});
    }
  }

  /* ---------- button handler ---------- */
  function createScheduledInvoice(){
    var rec=currentRecord.get();
    var poId=rec.id;
    showProcessing('Checking for eligible installments…');

    var svc=url.resolveScript({
      scriptId:'customscript_invoice_operations_sl',
      deploymentId:'customdeploy_invoice_operations_sl',
      params:{action:'validate_pledge_order',pledgeOrderId:poId}
    });

    https.get.promise({url:svc}).then(function(res){
      handle(JSON.parse(res.body||'{}'),poId);
    }).catch(function(e){
      showError('Validation failed: '+e.message,false);
    }).finally(clearProcessing);
  }

  function handle(r,poId){
    if(r.eligible){
      dialog.confirm({
        title:'Confirm Invoice Creation',
        message:'Create invoices for '+r.eligibleCount+
                ' installment'+(r.eligibleCount>1?'s':'')+
                ' (total $'+r.totalAmount.toFixed(2)+')?'
      }).then(function(yes){
        if(!yes)return;
        var sl=url.resolveScript({
          scriptId:'customscript_invoice_operations_sl',
          deploymentId:'customdeploy_invoice_operations_sl',
          params:{
            action:'create_from_pledge_order',
            pledgeOrderId:poId,
            returnUrl:window.location.href
          }
        });
        showProcessing('Creating invoices…');
        window.location.href=sl;
      });
      return;
    }
    showError(r.message, r.revenuePosted===true);
  }

  /* ---------- helpers ---------- */
  function showProcessing(txt){
    if(processingMsg) processingMsg.hide({duration:0});
    processingMsg=message.create({title:'Processing',message:txt,type:message.Type.INFORMATION});
    processingMsg.show();
  }
  function clearProcessing(){ if(processingMsg)processingMsg.hide({duration:0}); processingMsg=null; }
  function showError(txt,warn){
    message.create({
      title: warn?'Nothing to Invoice':'Invoice Creation Blocked',
      message:txt,
      type: warn?message.Type.WARNING:message.Type.ERROR
    }).show({duration:8000});
  }

  return{
    pageInit:pageInit,
    createScheduledInvoice:createScheduledInvoice
  };
});