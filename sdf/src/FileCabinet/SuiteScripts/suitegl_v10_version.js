/**
 * SuiteScript 1.0 Version - Invoice GL Plugin for Pledge Revenue Neutralization
 * 
 * PURPOSE: For invoices created from pledge orders where revenue was already posted:
 * 1. Neutralize the revenue (debit revenue, credit x1221 pledge receivable)
 * 2. Net effect: Convert x1221 pledge receivable to 1220 regular AR
 */

/**
 * Main SuiteGL entry point for INVOICES
 * @param {nlobjRecord} transactionRecord - The invoice being saved
 * @param {object} standardLines - Standard GL lines NetSuite would create
 * @param {object} customLines - Custom lines we can add
 * @param {string} book - Accounting book (if using multi-book)
 */
function customizeGlImpact(transactionRecord, standardLines, customLines, book) {
    try {
        nlapiLogExecution('DEBUG', 'Invoice GL Plugin Started', 
            'Record Type: ' + transactionRecord.getRecordType() + 
            ', TranID: ' + transactionRecord.getFieldValue('tranid'));
        
        // Only process invoices
        if (transactionRecord.getRecordType() !== 'invoice') {
            nlapiLogExecution('DEBUG', 'Not an invoice, skipping', transactionRecord.getRecordType());
            return;
        }
        
        // Check if this invoice is from a pledge order (Sales Order)
        var createdFromSO = transactionRecord.getFieldValue('createdfrom');
        if (!createdFromSO) {
            nlapiLogExecution('DEBUG', 'Invoice not created from Sales Order, skipping');
            return;
        }
        
        // Load the source Sales Order to check if it's a pledge order
        var sourceSORecord = nlapiLoadRecord('salesorder', createdFromSO);
        
        // Check if this is a pledge order
        var isPledgeOrder = sourceSORecord.getFieldValue('custbody_npo_pledge_promise');
        if (isPledgeOrder !== 'T' && isPledgeOrder !== true) {
            nlapiLogExecution('DEBUG', 'Source SO is not a pledge order, skipping', 
                'custbody_npo_pledge_promise: ' + isPledgeOrder);
            return;
        }
        
        // ENHANCED CHECK: Has revenue already been posted for this pledge order (current OR legacy)?
        var revenuePosted = sourceSORecord.getFieldValue('custbody_pledge_rev_posted');
        var legacyRevRecognized = sourceSORecord.getFieldValue('custbody_legacy_rev_recognized');
        if ((revenuePosted !== 'T' && revenuePosted !== true) && (legacyRevRecognized !== 'T' && legacyRevRecognized !== true)) {
            nlapiLogExecution('DEBUG', 'Revenue not yet posted for pledge order, allowing normal invoice processing', 
                'custbody_pledge_rev_posted: ' + revenuePosted + ', custbody_legacy_rev_recognized: ' + legacyRevRecognized + ', Pledge Order ID: ' + createdFromSO);
            return;
        }
        
        nlapiLogExecution('AUDIT', 'PLEDGE INVOICE WITH REVENUE ALREADY POSTED - Processing GL Adjustments', 
            'Pledge Order ID: ' + createdFromSO + 
            ', Revenue Posted: ' + revenuePosted + 
            ', Legacy Rev Recognized: ' + legacyRevRecognized +
            ', Invoice ID: ' + transactionRecord.getId());
        
        // Process the pledge invoice adjustments
        processPledgeInvoiceAdjustments(transactionRecord, standardLines, customLines, sourceSORecord);
        
    } catch (error) {
        nlapiLogExecution('ERROR', 'Invoice GL Plugin Error', error.toString());
        // Don't throw - allow normal processing if plugin fails
    }
}

/**
 * Process GL adjustments for pledge invoices where revenue was already posted
 * @param {nlobjRecord} transactionRecord - The invoice
 * @param {object} standardLines - Standard GL lines
 * @param {object} customLines - Custom lines we can add
 * @param {nlobjRecord} sourceSORecord - The source Sales Order
 */
function processPledgeInvoiceAdjustments(transactionRecord, standardLines, customLines, sourceSORecord) {
    
    nlapiLogExecution('DEBUG', 'Processing Pledge Invoice Adjustments');
    
    // Get invoice total to determine adjustment amounts
    var invoiceTotal = parseFloat(transactionRecord.getFieldValue('total') || 0);
    if (invoiceTotal <= 0) {
        nlapiLogExecution('DEBUG', 'Invoice total is zero or negative, skipping adjustments', 'Total: ' + invoiceTotal);
        return;
    }
    
    // Get the standard lines to analyze
    var standardLineCount = standardLines.getCount();
    nlapiLogExecution('DEBUG', 'Standard Lines Count', standardLineCount);
    
    var revenueLines = [];
    var arLine = null;
    
    // Analyze each standard line
    for (var i = 0; i < standardLineCount; i++) {
        var line = standardLines.getLine(i);
        var accountId = line.getAccountId();
        var creditAmount = line.getCreditAmount() || 0;
        var debitAmount = line.getDebitAmount() || 0;
        
        nlapiLogExecution('DEBUG', 'Analyzing Standard Line ' + i, 
            'Account ID: ' + accountId + 
            ', Debit: ' + debitAmount + 
            ', Credit: ' + creditAmount);
        
        // Identify AR line (account 1220/119)
        if (accountId == 119 || accountId == '119' || accountId == 1220 || accountId == '1220') {
            if (debitAmount > 0) {
                arLine = {
                    index: i,
                    line: line,
                    accountId: accountId,
                    debitAmount: debitAmount
                };
                nlapiLogExecution('DEBUG', 'Found AR Line', 
                    'Account ' + accountId + ' debit $' + debitAmount);
            }
        }
        
        // Identify revenue lines (credits, excluding AR accounts)
        var knownARAccounts = [119, 1220, 741, '119', '1220', '741']; // Include both AR accounts
        var isRevenueLine = (creditAmount > 0 && 
                           knownARAccounts.indexOf(accountId) === -1 && 
                           knownARAccounts.indexOf(accountId.toString()) === -1);
        
        if (isRevenueLine) {
            revenueLines.push({
                index: i,
                line: line,
                accountId: accountId,
                creditAmount: creditAmount
            });
            nlapiLogExecution('DEBUG', 'Found Revenue Line', 
                'Account ' + accountId + ' credit $' + creditAmount);
        }
    }
    
    nlapiLogExecution('AUDIT', 'Line Analysis Complete', 
        'Found ' + revenueLines.length + ' revenue lines, AR line: ' + (arLine ? 'Yes' : 'No'));
    
    if (!arLine) {
        nlapiLogExecution('ERROR', 'No AR line found in standard lines', 'Cannot process adjustments');
        return;
    }
    
    // Step 1: Neutralize each revenue line (debit revenue, credit x1221)
    var totalRevenueNeutralized = 0;
    for (var j = 0; j < revenueLines.length; j++) {
        var revenueLine = revenueLines[j];
        
        nlapiLogExecution('AUDIT', 'Neutralizing Revenue Line ' + (j + 1), 
            'Account: ' + revenueLine.accountId + 
            ', Credit Amount: $' + revenueLine.creditAmount);
        
        // Create debit to revenue account to neutralize it
        var revenueDebitLine = customLines.addNewLine();
        revenueDebitLine.setAccountId(revenueLine.accountId);
        revenueDebitLine.setDebitAmount(revenueLine.creditAmount);
        
        // Set entity on revenue line (should be safe since it's not AR)
        var entityId = transactionRecord.getFieldValue('entity');
        if (entityId) {
            try {
                revenueDebitLine.setEntityId(parseInt(entityId, 10));
            } catch (e) {
                nlapiLogExecution('DEBUG', 'Could not set entity on revenue debit line', e.toString());
            }
        }
        revenueDebitLine.setMemo('Pledge revenue already posted - neutralizing account with Internal ID ' + revenueLine.accountId);
        
        totalRevenueNeutralized += revenueLine.creditAmount;
    }

    // Step 2: Create credit to x1221 to balance the revenue debits
    if (totalRevenueNeutralized > 0) {
        var pledgeReceivableCreditLine = customLines.addNewLine();
        pledgeReceivableCreditLine.setAccountId(741); // x1221 Pledge Order Receivables
        pledgeReceivableCreditLine.setCreditAmount(totalRevenueNeutralized);
        
        // SET entity for better tracking
        var entityId = transactionRecord.getFieldValue('entity');
        if (entityId) {
            try {
                pledgeReceivableCreditLine.setEntityId(parseInt(entityId, 10));
            } catch (e) {
                nlapiLogExecution('DEBUG', 'Could not set entity on x1221 credit line', e.toString());
            }
        }
        pledgeReceivableCreditLine.setMemo('Reducing Unbilled Pledge Receivable upon Invoicing - No Net AR Impact');
        
        nlapiLogExecution('AUDIT', 'Created x1221 Credit Line', 
            'Account 741 Credit $' + totalRevenueNeutralized + ' (with entity: ' + entityId + ')');
    }

    /* ORIGINAL VERSION - WITHOUT ENTITY (kept for reference/rollback)
    // Step 2: Create credit to x1221 to balance the revenue debits
    if (totalRevenueNeutralized > 0) {
        var pledgeReceivableCreditLine = customLines.addNewLine();
        pledgeReceivableCreditLine.setAccountId(741); // x1221 Pledge Order Receivables
        pledgeReceivableCreditLine.setCreditAmount(totalRevenueNeutralized);
        
        // DO NOT set entity on this line to avoid subledger issues
        pledgeReceivableCreditLine.setMemo('Reducing pledge receivable for invoice payment - no aging impact');
    }
    */
    
    nlapiLogExecution('AUDIT', 'Pledge Invoice GL Adjustments Complete', 
        'Revenue Neutralized: $' + totalRevenueNeutralized + 
        ', AR Debit: $' + arLine.debitAmount + 
        ', Net Effect: Converted x1221 pledge receivable to 1220 regular AR');
    
    // Log the accounting effect
    nlapiLogExecution('AUDIT', 'ACCOUNTING EFFECT SUMMARY', 
        'BEFORE: x1221 Pledge Receivable (higher), Revenue already recognized' +
        ' AFTER: 1220 Regular AR +$' + arLine.debitAmount + ', Revenue neutralized, x1221 reduced by $' + totalRevenueNeutralized +
        ' RESULT: Pledge receivable converted to aging AR, no duplicate revenue');
}