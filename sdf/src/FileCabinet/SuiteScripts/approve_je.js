/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 */
define(['N/search', 'N/record', 'N/log'], (search, record, log) => {

  const execute = () => {
    let totalFound = 0;
    let approvedCount = 0;
    let errorCount = 0;

    log.audit({
      title: 'JE Approval Script',
      details: 'Begin execution... Approving ALL JEs created today with Pending Approval status'
    });

    try {
      const jeSearch = search.create({
        type: search.Type.JOURNAL_ENTRY,
        filters: [
          ['approvalstatus', 'is', '1'],            // Pending Approval
          'AND',
          ['datecreated', 'onorafter', 'today']     // Created Today
        ],
        columns: ['internalid', 'tranid']
      });

      const pagedResults = jeSearch.runPaged({ pageSize: 1000 });
      const uniqueIds = new Set();

      pagedResults.pageRanges.forEach((pageRange, idx) => {
        log.audit({
          title: `Processing Page ${idx + 1}`,
          details: `Fetching results from index ${pageRange.index}`
        });

        const page = pagedResults.fetch({ index: pageRange.index });
        page.data.forEach(result => {
          const id = result.getValue({ name: 'internalid' });
          const tranid = result.getValue({ name: 'tranid' });

          if (id && !uniqueIds.has(id)) {
            uniqueIds.add(id);
            log.debug({
              title: 'Found JE',
              details: `Queued for approval: JE ID ${id}, Tran ID ${tranid}`
            });
          }
        });
      });

      totalFound = uniqueIds.size;
      log.audit({
        title: 'Total JEs Found Today Pending Approval',
        details: `${totalFound} entries`
      });

      for (const id of uniqueIds) {
        try {
          const je = record.load({
            type: record.Type.JOURNAL_ENTRY,
            id: id,
            isDynamic: false
          });

          const currentStatus = je.getValue('approvalstatus');

          if (currentStatus !== 2) {
            je.setValue({
              fieldId: 'approvalstatus',
              value: 2
            });

            je.save({ ignoreMandatoryFields: true });
            approvedCount++;

            log.audit({
              title: 'Approved JE',
              details: `✅ JE ID ${id} approved`
            });
          } else {
            log.debug({
              title: 'Skipped JE',
              details: `JE ID ${id} was already approved`
            });
          }

        } catch (err) {
          errorCount++;
          log.error({
            title: `Error approving JE ID ${id}`,
            details: err.message
          });
        }
      }

      log.audit({
        title: 'JE Approval Script Complete',
        details: `✅ Approved: ${approvedCount} | ⚠️ Errors: ${errorCount} | 🔍 Searched: ${totalFound}`
      });

    } catch (fatal) {
      log.error({
        title: 'Fatal Script Error',
        details: fatal.message
      });
    }
  };

  return { execute };

});