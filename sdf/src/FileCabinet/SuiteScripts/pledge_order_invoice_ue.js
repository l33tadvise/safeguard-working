/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @description Pledge Order Invoice User Event - Adds "Create Scheduled Invoice" button
 * File: pledge_order_invoice_ue.js
 * Applies To: Sales Order (Transaction)
 */

define(['N/runtime', 'N/log'], 
function(runtime, log) {

    function beforeLoad(context) {
        if (context.type !== context.UserEventType.VIEW) {
            return;
        }

        const record = context.newRecord;
        const form = context.form;

        try {
            // Only add button if this is a pledge order
            const isPledge = record.getValue('custbody_npo_pledge_promise');
            
            if (isPledge === true || isPledge === 'T') {
                addCreateScheduledInvoiceButton(form, record.id);
                addClientScript(form);
            }

        } catch (error) {
            log.error('Error in pledge order beforeLoad', {
                recordId: record.id,
                error: error.message
            });
        }
    }

    function addCreateScheduledInvoiceButton(form, recordId) {
        // Add the button
        form.addButton({
            id: 'custpage_create_scheduled_invoice',
            label: 'Create Scheduled Invoice',
            functionName: 'createScheduledInvoice'
        });

        log.debug('Added Create Scheduled Invoice button', { recordId: recordId });
    }

    function addClientScript(form) {
        const script = runtime.getCurrentScript();
        const clientScriptId = script.getParameter('custscript_pledge_order_client_id');

        if (clientScriptId) {
            form.clientScriptFileId = parseInt(clientScriptId, 10);
            log.debug('Added client script via parameter', { clientScriptId: clientScriptId });
        } else {
            // Fallback to module path
            form.clientScriptModulePath = './pledge_order_invoice_client.js';
            log.debug('Added client script via module path');
        }
    }

    return {
        beforeLoad: beforeLoad
    };
});
