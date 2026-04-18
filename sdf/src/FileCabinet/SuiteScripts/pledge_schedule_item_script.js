/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search', 'N/log'], (record, search, log) => {

    /**
     * Executes before record is submitted
     * Populates Pledge Order Item from first line of linked Pledge Order
     */
    function beforeSubmit(context) {
        if (context.type !== context.UserEventType.CREATE && 
            context.type !== context.UserEventType.EDIT) {
            return;
        }

        const pledgeSchedule = context.newRecord;
        const pledgeOrderId = pledgeSchedule.getValue('custrecord_linked_pledge_order');
        
        // Only populate if we have a pledge order but no item set yet
        if (pledgeOrderId && !pledgeSchedule.getValue('custrecord_pledge_order_item')) {
            try {
                const itemId = getFirstLineItemFromPledgeOrder(pledgeOrderId);
                if (itemId) {
                    pledgeSchedule.setValue('custrecord_pledge_order_item', itemId);
                    log.debug('Pledge Schedule Item Set', {
                        pledgeScheduleId: pledgeSchedule.id || 'NEW',
                        pledgeOrderId: pledgeOrderId,
                        itemId: itemId
                    });
                }
            } catch (e) {
                log.error('Error setting pledge order item', {
                    pledgeOrderId: pledgeOrderId,
                    error: e.message
                });
            }
        }

        // Also handle Restricted Purpose if it needs line-level defaulting
        handleRestrictedPurpose(pledgeSchedule, pledgeOrderId);
    }

    /**
     * Executes after record is submitted
     * Updates Period Restriction to match the period containing the installment date
     */
    function afterSubmit(context) {
        log.debug('afterSubmit triggered', {
            type: context.type,
            isCreate: context.type === context.UserEventType.CREATE,
            isEdit: context.type === context.UserEventType.EDIT
        });

        if (context.type !== context.UserEventType.CREATE && 
            context.type !== context.UserEventType.EDIT) {
            log.debug('afterSubmit skipped - wrong context type', context.type);
            return;
        }

        const pledgeScheduleId = context.newRecord.id;
        const installmentDate = context.newRecord.getValue('custrecord_ps_installment_date');
        
        log.debug('afterSubmit values', {
            pledgeScheduleId: pledgeScheduleId,
            installmentDate: installmentDate
        });
        
        // Only process if we have an installment date
        if (installmentDate) {
            try {
                log.debug('Getting period for date', installmentDate);
                const correctPeriodId = getAccountingPeriodForDate(installmentDate);
                log.debug('Calculated period ID', correctPeriodId);
                
                if (correctPeriodId) {
                    // Load the record to check current value and update if needed
                    log.debug('Looking up current period restriction');
                    const lookupResult = search.lookupFields({
                        type: 'customrecord_pledge_schedule',
                        id: pledgeScheduleId,
                        columns: ['custrecord_period_restriction']
                    });
                    
                    log.debug('Lookup result', lookupResult);
                    const currentPeriodId = lookupResult.custrecord_period_restriction[0]?.value;
                    log.debug('Current vs Calculated periods', {
                        currentPeriodId: currentPeriodId,
                        correctPeriodId: correctPeriodId,
                        needsUpdate: currentPeriodId !== correctPeriodId
                    });

                    // Only update if the period is different from what was calculated
                    if (currentPeriodId !== correctPeriodId) {
                        log.debug('Updating period restriction', {
                            from: currentPeriodId,
                            to: correctPeriodId
                        });
                        
                        record.submitFields({
                            type: 'customrecord_pledge_schedule',
                            id: pledgeScheduleId,
                            values: {
                                custrecord_period_restriction: correctPeriodId
                            }
                        });

                        log.debug('Period Restriction Updated', {
                            pledgeScheduleId: pledgeScheduleId,
                            installmentDate: installmentDate,
                            fromPeriodId: currentPeriodId,
                            toPeriodId: correctPeriodId
                        });
                    } else {
                        log.debug('Period Restriction Already Correct', {
                            pledgeScheduleId: pledgeScheduleId,
                            installmentDate: installmentDate,
                            periodId: correctPeriodId
                        });
                    }
                } else {
                    log.debug('No period found for installment date', installmentDate);
                }
            } catch (e) {
                log.error('Error updating period restriction in afterSubmit', {
                    pledgeScheduleId: pledgeScheduleId,
                    installmentDate: installmentDate,
                    error: e.message,
                    stack: e.stack
                });
            }
        } else {
            log.debug('No installment date found, skipping period update');
        }
    }

    /**
     * Gets the first line item from a Sales Order (Pledge Order)
     */
    function getFirstLineItemFromPledgeOrder(salesOrderId) {
        try {
            // Use search to get the first line item efficiently
            const itemSearch = search.create({
                type: search.Type.TRANSACTION,
                filters: [
                    ['internalid', 'anyof', salesOrderId],
                    'AND',
                    ['mainline', 'is', 'F'], // Only line items, not header
                    'AND',
                    ['type', 'anyof', 'SalesOrd']
                ],
                columns: [
                    'item',
                    'line'
                ]
            });

            const firstResult = itemSearch.run().getRange({
                start: 0,
                end: 1
            })[0];

            if (firstResult) {
                const itemId = firstResult.getValue('item');
                log.debug('First Line Item Found', {
                    salesOrderId: salesOrderId,
                    itemId: itemId,
                    line: firstResult.getValue('line')
                });
                return itemId;
            }

            log.debug('No Line Items Found', `Sales Order ${salesOrderId} has no line items`);
            return null;

        } catch (e) {
            log.error('Error getting first line item', {
                salesOrderId: salesOrderId,
                error: e.message
            });
            return null;
        }
    }

    /**
     * Handle Restricted Purpose defaulting if needed
     */
    function handleRestrictedPurpose(pledgeSchedule, pledgeOrderId) {
        // Only set if not already populated
        if (pledgeOrderId && !pledgeSchedule.getValue('custrecord_restrict_purpose')) {
            try {
                // Get restricted purpose from the first line or header of pledge order
                const restrictedPurpose = getRestrictedPurposeFromPledgeOrder(pledgeOrderId);
                if (restrictedPurpose) {
                    pledgeSchedule.setValue('custrecord_restrict_purpose', restrictedPurpose);
                    log.debug('Restricted Purpose Set', {
                        pledgeOrderId: pledgeOrderId,
                        restrictedPurpose: restrictedPurpose
                    });
                }
            } catch (e) {
                log.error('Error setting restricted purpose', {
                    pledgeOrderId: pledgeOrderId,
                    error: e.message
                });
            }
        }
    }

    /**
     * Gets restricted purpose from pledge order - CORRECTED VERSION
     * cseg_npo_restrictn is a BODY field, referenced as line.cseg_npo_restrictn in line searches
     */
    function getRestrictedPurposeFromPledgeOrder(salesOrderId) {
        try {
            // Option 1: Get directly from SO header using lookupFields
            const soFields = search.lookupFields({
                type: search.Type.SALES_ORDER,
                id: salesOrderId,
                columns: ['cseg_npo_restrictn'] // Body field - CORRECTED
            });

            if (soFields.cseg_npo_restrictn && soFields.cseg_npo_restrictn[0]) {
                return soFields.cseg_npo_restrictn[0].value;
            }

            // Option 2: Get from line search (referencing body field as line.cseg_npo_restrictn)
            const lineSearch = search.create({
                type: search.Type.TRANSACTION,
                filters: [
                    ['internalid', 'anyof', salesOrderId],
                    'AND',
                    ['mainline', 'is', 'F'] // Line items only
                ],
                columns: [
                    'line.cseg_npo_restrictn', // Body field referenced from line search - CORRECTED
                    'line'
                ]
            });

            const firstLineResult = lineSearch.run().getRange({
                start: 0,
                end: 1
            })[0];

            if (firstLineResult) {
                const restrictionValue = firstLineResult.getValue('line.cseg_npo_restrictn');
                if (restrictionValue) {
                    return restrictionValue;
                }
            }

            return null;

        } catch (e) {
            log.error('Error getting restricted purpose', {
                salesOrderId: salesOrderId,
                error: e.message
            });
            return null;
        }
    }

 /**
 * Gets the accounting period that contains the given date
 */
function getAccountingPeriodForDate(targetDate) {
    try {
        // Ensure targetDate is a proper Date object
        const dateObj = new Date(targetDate);
        const formattedDate = formatDate(dateObj);

        log.debug('Starting period search for date', {
            raw: targetDate,
            formatted: formattedDate
        });

        const periodSearch = search.create({
            type: 'accountingperiod',
            filters: [
                ['startdate', 'onorbefore', formattedDate],
                'AND',
                ['enddate', 'onorafter', formattedDate],
                'AND',
                ['isquarter', 'is', 'F'],
                'AND',
                ['isyear', 'is', 'F'],
                'AND',
                ['isinactive', 'is', 'F']
            ],
            columns: [
                'internalid',
                'periodname',
                'startdate',
                'enddate'
            ]
        });

        log.debug('Period search created, running search');

        const result = periodSearch.run().getRange({ start: 0, end: 1 })[0];

        if (result) {
            const periodId = result.getValue('internalid');
            log.debug('Accounting Period Found', {
                targetDate: targetDate,
                formattedDate: formattedDate,
                periodId: periodId,
                periodName: result.getValue('periodname'),
                startDate: result.getValue('startdate'),
                endDate: result.getValue('enddate')
            });
            return periodId;
        }

        log.debug('No Accounting Period Found', `No period found for date ${formattedDate}`);
        return null;

    } catch (e) {
        log.error('Error finding accounting period', {
            targetDate: targetDate,
            error: e.message,
            stack: e.stack
        });
        return null;
    }
}

/**
 * Converts a JS Date object to MM/DD/YYYY format required by NetSuite date filters
 */
function formatDate(dateObj) {
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    return `${mm}/${dd}/${yyyy}`;
}


    return {
        beforeSubmit: beforeSubmit,
        afterSubmit: afterSubmit
    };
});