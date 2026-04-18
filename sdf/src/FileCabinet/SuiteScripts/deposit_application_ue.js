/**
 * Deposit Application UE → trigger pledge schedule sync for applied invoices
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search', 'N/runtime', 'N/log', './pledge_schedule_sync_lib'],
function (record, search, runtime, log, lib) {

  function afterSubmit(ctx) {
    try {
      log.audit('DA-UE heartbeat', {
        eventType: ctx.type,
        execCtx: runtime.executionContext,
        newId: ctx.newRecord && ctx.newRecord.id,
        oldId: ctx.oldRecord && ctx.oldRecord.id
      });

      if (ctx.type === ctx.UserEventType.DELETE) {
        // On delete the record may not be loadable; discover invoices via link rows
        var daId = ctx.oldRecord && ctx.oldRecord.id;
        if (!daId) return;

        var seen = {};
        var s = search.create({
          type: search.Type.TRANSACTION,
          filters: [
            ['applyingtransaction', 'anyof', daId], 'AND',
            ['mainline', 'is', 'F']
          ],
          columns: [
            search.createColumn({ name: 'appliedtotransaction' })
          ]
        });

        s.run().each(function (r) {
          var invId = r.getValue({ name: 'appliedtotransaction' });
          if (invId && !seen[invId]) {
            seen[invId] = true;
            log.debug('DA-UE delete → syncing invoice', { daId: daId, invId: invId });
            lib.syncFromInvoice(invId);
          }
          return true;
        });
        return;
      }

      // CREATE / EDIT: always reload to ensure 'apply' sublist is populated
      var daType = ctx.newRecord && ctx.newRecord.type || record.Type.DEPOSIT_APPLICATION;
      var daId   = ctx.newRecord && ctx.newRecord.id;
      if (!daId) return;

      var da = record.load({ type: daType, id: daId });
      var lines = da.getLineCount({ sublistId: 'apply' }) || 0;

      log.debug('DA-UE loaded', { daType: daType, daId: daId, applyLines: lines });

      var invoked = 0;
      for (var i = 0; i < lines; i++) {
        var isApplied = da.getSublistValue({ sublistId: 'apply', fieldId: 'apply', line: i });
        if (!(isApplied === true || isApplied === 'T')) continue;

        var rowType = da.getSublistValue({ sublistId: 'apply', fieldId: 'type', line: i });
        if (rowType !== 'Invoice') continue; // only sync invoices

        var docId = da.getSublistValue({ sublistId: 'apply', fieldId: 'doc',       line: i });
        var intId = da.getSublistValue({ sublistId: 'apply', fieldId: 'internalid', line: i });
        var invId = docId || intId;

        var amt   = da.getSublistValue({ sublistId: 'apply', fieldId: 'amount', line: i });

        if (!invId) {
          log.error('DA-UE apply row missing invoice id', { i: i, doc: docId, internalid: intId });
          continue;
        }

        log.debug('DA-UE apply row', { invId: invId, amount: amt, i: i });
        lib.syncFromInvoice(invId);
        invoked++;
      }

      log.audit('DA-UE complete', { daId: daId, invoicesSynced: invoked });

    } catch (e) {
      log.error('DA-UE fatal', { message: e.message, stack: e.stack, eventType: ctx.type });
    }
  }

  return { afterSubmit: afterSubmit };
});
