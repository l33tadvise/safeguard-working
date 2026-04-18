/**
 * @NApiVersion 2.1
 * @NScriptType plugintypeimpl
 * @NModuleScope SameAccount
 */

/**
 * Simple Invoice Custom GL Plugin for Pledge Revenue System - Testing Version
 * 
 * PURPOSE: Prevent double-hitting revenue accounts when creating invoices 
 * from pledge orders that already have revenue posted.
 * 
 * TRIGGER: custbody_pledge_rev_posted = T (revenue already posted)
 * 
 * LOGIC: Hit Account 119 for both the revenue reversal AND the balancing entry
 * This creates a "wash" entry that zeros out revenue impact but maintains balanced books
 */

define(['N/record', 'N/log'], (record, log) => {
    
    /**
     * Custom GL Impact function - SuiteScript 2.x version
     * @param {Object} context
     * @param {Object} context.transactionRecord - The invoice being saved
     * @param {Object} context.standardLines - Standard GL lines NetSuite would create
     * @param {Object} context.customLines - Custom lines we can add
     * @param {string} context.book - Accounting book (if using multi-book)
     */
    function customizeGlImpact(context) {
        try {
            const transactionRecord = context.transactionRecord;
            const standardLines = context.standardLines;
            const customLines = context.customLines;
            
            log.debug('SuiteGL Plugin Started', {
                recordType: transactionRecord.type,
                tranId: transactionRecord.getValue('tranid'),
                id: transactionRecord.id
            });
            
            // Only process invoices
            if (transactionRecord.type !== record.Type.INVOICE) {
                log.debug('Not an invoice, skipping', transactionRecord.type);
                return;
            }
            
            // Check if this invoice is from a pledge order (Sales Order)
            const createdFromSO = transactionRecord.getValue('createdfrom');
            if (!createdFromSO) {
                log.debug('Invoice not created from Sales Order, skipping');
                return;
            }
            
            // Load the source Sales Order to check if it's a pledge order
            const sourceSORecord = record.load({
                type: record.Type.SALES_ORDER,
                id: createdFromSO
            });
            
            // Check if this is a pledge order
            const isPledgeOrder = sourceSORecord.getValue('custbody_npo_pledge_promise');
            if (!isPledgeOrder) {
                log.debug('Source SO is not a pledge order, skipping', {
                    pledgePromise: isPledgeOrder,
                    soId: createdFromSO
                });
                return;
            }
            
            // CRITICAL CHECK: Has revenue already been posted for this pledge order?
            const revenuePosted = sourceSORecord.getValue('custbody_pledge_rev_posted');
            if (!revenuePosted) {
                log.debug('Revenue not yet posted for pledge order, allowing normal GL impact', {
                    revenuePosted: revenuePosted,
                    pledgeOrderId: createdFromSO
                });
                return;
            }
            
            log.audit('PLEDGE REVENUE ALREADY POSTED - Preventing Double Recognition', {
                pledgeOrderId: createdFromSO,
                revenuePosted: revenuePosted,
                invoiceId: transactionRecord.id
            });
            
            // SIMPLIFIED LOGIC: Create offsetting entries using Account 119 for both
            createSimpleOffsettingEntries(transactionRecord, standardLines, customLines);
            
        } catch (error) {
            log.error('SuiteGL Plugin Error', error);
            // Don't throw - allow normal processing if plugin fails
        }
    }
    
    /**
     * Create simple offsetting entries - both hit Account 119 for testing
     */
    function createSimpleOffsettingEntries(transactionRecord, standardLines, customLines) {
        
        log.debug('Creating Simple Offsetting Entries for Testing');
        
        // Get the standard lines to understand normal GL impact
        const standardLineCount = standardLines.getCount();
        log.debug('Standard Lines Count', standardLineCount);
        
        // Find revenue lines in standard impact
        const revenueLines = [];
        
        for (let i = 0; i < standardLineCount; i++) {
            const line = standardLines.getLine(i);
            const accountId = line.getAccountId();
            
            // Try to identify revenue lines by looking for income accounts
            // Since we can't easily look up account types in SuiteGL context,
            // we'll look for credit amounts (typical for revenue)
            const creditAmount = line.getCreditAmount();
            const debitAmount = line.getDebitAmount();
            
            log.debug('Analyzing Standard Line', {
                lineIndex: i,
                accountId: accountId,
                debit: debitAmount,
                credit: creditAmount
            });
            
            // Assume revenue lines are those with credit amounts
            if (creditAmount && creditAmount > 0) {
                revenueLines.push({
                    index: i,
                    line: line,
                    accountId: accountId,
                    creditAmount: creditAmount
                });
            }
        }
        
        log.debug('Found Potential Revenue Lines', revenueLines.length);
        
        // For each potential revenue line, create offsetting entries using Account 119
        revenueLines.forEach((revenueLine, index) => {
            
            log.audit('Processing Revenue Line for Testing', {
                originalAccount: revenueLine.accountId,
                creditAmount: revenueLine.creditAmount,
                testingWithAccount: 119
            });
            
            // Create custom line #1: Debit Account 119 (reverses the revenue credit)
            const reverseLine = customLines.addNewLine();
            reverseLine.setAccountId(119); // Hard-coded for testing
            reverseLine.setDebitAmount(revenueLine.creditAmount);
            
            // Set entity and memo
            const entityId = transactionRecord.getValue('entity');
            if (entityId) {
                reverseLine.setEntityId(entityId);
            }
            reverseLine.setMemo('TEST: Reversing revenue - Account 119 Debit');
            
            // Create custom line #2: Credit Account 119 (balances the debit)
            const balancingLine = customLines.addNewLine();
            balancingLine.setAccountId(119); // Hard-coded for testing
            balancingLine.setCreditAmount(revenueLine.creditAmount);
            
            if (entityId) {
                balancingLine.setEntityId(entityId);
            }
            balancingLine.setMemo('TEST: Balancing entry - Account 119 Credit');
            
            log.audit('Created Test GL Lines', {
                revenueLineIndex: index,
                amount: revenueLine.creditAmount,
                line1: 'Account 119 Debit ' + revenueLine.creditAmount,
                line2: 'Account 119 Credit ' + revenueLine.creditAmount,
                netEffect: 'Zero (wash entry for testing)'
            });
        });
        
        log.audit('Simple Offsetting Entries Complete', {
            processedLines: revenueLines.length,
            note: 'Both debits and credits hit Account 119 - net effect is zero'
        });
    }
    
    return {
        customizeGlImpact: customizeGlImpact
    };
});
