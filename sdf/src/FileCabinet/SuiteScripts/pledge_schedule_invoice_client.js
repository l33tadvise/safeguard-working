/**
 * Pledge Schedule – Create Invoice  (13-Jun-2025)
 *
 * @NApiVersion 2.1
 * @NScriptType  ClientScript
 */
define(['N/currentRecord','N/ui/dialog','N/url','N/https','N/ui/message'],
function(currentRecord,dialog,url,https,message){

  var processingMsg;

  function pageInit(){
    var p=new URLSearchParams(window.location.search);
    if(p.has('invCount')){
      message.create({
        title:'Invoice Created',
        message:'Invoice #'+p.get('invFirst')+
                ' created for $'+p.get('invTotal')+'.',
        type:message.Type.CONFIRMATION
      }).show({duration:6000});
    }
  }

  function createInvoiceForSchedule(){
    var rec=currentRecord.get();
    var schId=rec.id;
    showProcessing('Validating installment…');

    var svc=url.resolveScript({
      scriptId:'customscript_invoice_operations_sl',
      deploymentId:'customdeploy_invoice_operations_sl',
      params:{action:'validate_schedule',scheduleId:schId}
    });

    https.get.promise({url:svc}).then(function(res){
      handle(JSON.parse(res.body||'{}'),schId);
    }).catch(function(e){
      showError('Validation failed: '+e.message,false);
    }).finally(clearProcessing);
  }

  function handle(r,schId){
    if(r.eligible){
      dialog.confirm({
        title:'Confirm Invoice Creation',
        message:'Create the invoice for this installment?'
      }).then(function(yes){
        if(!yes)return;
        var sl=url.resolveScript({
          scriptId:'customscript_invoice_operations_sl',
          deploymentId:'customdeploy_invoice_operations_sl',
          params:{
            action:'create_from_schedule',
            scheduleId:schId,
            returnUrl:window.location.href
          }
        });
        showProcessing('Creating invoice…');
        window.location.href=sl;
      });
      return;
    }
    showError(r.message,true);
  }

  function showProcessing(txt){
    if(processingMsg)processingMsg.hide({duration:0});
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
    createInvoiceForSchedule:createInvoiceForSchedule,
    createInvoice:createInvoiceForSchedule   // button expects this name
  };
});