/**
 * Make Linked-Invoice click open a new tab
 * @NApiVersion 2.x
 * @NScriptType  UserEventScript
 */
define([], function () {
    function beforeLoad (ctx) {
        if (ctx.type !== ctx.UserEventType.VIEW) return;

        var rec   = ctx.newRecord;
        var invId = rec.getValue('custrecord_po_invoice');
        if (!invId) return;

        var html = '<a href="/app/accounting/transactions/custinvc.nl?id=' +
                   invId + '" target="_blank">Invoice #' + invId + '</a>';
        rec.setText({ fieldId:'custrecord_po_invoice', text: html });
    }
    return { beforeLoad: beforeLoad };
});