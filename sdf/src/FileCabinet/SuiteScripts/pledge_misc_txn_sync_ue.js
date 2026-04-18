/**
 * UE to sync payments, credits & refunds back to the pledge schedule
 * Deploy this file to: Customer Payment, Credit Memo, Customer Refund
 * @NApiVersion 2.x
 * @NScriptType  UserEventScript
 */
define(['N/runtime', 'N/record', 'N/log', './pledge_schedule_sync_lib'],
function(runtime, record, log, lib) {

    function afterSubmit(ctx) {
        try {
            // Skip XEDIT since it fires multiple times and causes redundancy
            if (ctx.type === ctx.UserEventType.XEDIT) return;

            // Use oldRecord if DELETE, otherwise newRecord
            var rec = (ctx.type === ctx.UserEventType.DELETE) ? ctx.oldRecord : ctx.newRecord;
            if (!rec) return;

            var lines = rec.getLineCount({ sublistId: 'apply' });
            for (var i = 0; i < lines; i++) {
                var shouldSync = false;

                if (ctx.type === ctx.UserEventType.DELETE) {
                    // On DELETE, always re-sync all invoices that were applied
                    shouldSync = true;
                } else {
                    // For CREATE or EDIT, only sync lines marked as applied
                    var isApplied = rec.getSublistValue({
                        sublistId: 'apply',
                        fieldId: 'apply',
                        line: i
                    });
                    shouldSync = isApplied === true || isApplied === 'T';
                }

                if (!shouldSync) continue;

                var invId = rec.getSublistValue({
                    sublistId: 'apply',
                    fieldId: 'internalid',
                    line: i
                });

                if (invId) {
                    log.debug('Calling syncFromInvoice', {
                        invoiceId: invId,
                        eventType: ctx.type,
                        scriptType: runtime.executionContext
                    });
                    lib.syncFromInvoice(invId);
                }
            }
        } catch (e) {
            log.error('pledge_misc_txn_sync_ue error', {
                message: e.message,
                stack: e.stack,
                eventType: ctx.type
            });
        }
    }

    return { afterSubmit: afterSubmit };
});
