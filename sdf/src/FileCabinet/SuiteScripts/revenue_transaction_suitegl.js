/**
 * SuiteScript 1.0 - SuiteGL Plugin for Custom Revenue Transactions (Type 110)
 * 
 * PURPOSE: Remove entity from debit lines on Pledge Revenue Postings
 * Wash out subledger, then post asset without entity
 */

function customizeGlImpact(transactionRecord, standardLines, customLines, book) {
    try {
        // Only process our custom revenue transaction type
        if (transactionRecord.getRecordType() !== 'customsale_pledge_revenue_posting') {
            return;
        }
        
        nlapiLogExecution('AUDIT', 'Processing Pledge Revenue Posting', 
            'Washing out subledger and reposting without entity');
        
        // Process debit lines
        processDebitLines(standardLines, customLines);
        
    } catch (error) {
        nlapiLogExecution('ERROR', 'SuiteGL Error', error.toString());
    }
}

function processDebitLines(standardLines, customLines) {
    var standardLineCount = standardLines.getCount();
    
    nlapiLogExecution('DEBUG', 'Total Standard Lines Found', standardLineCount);
    
    for (var i = 0; i < standardLineCount; i++) {
        var line = standardLines.getLine(i);
        var accountId = line.getAccountId();
        var debitAmount = line.getDebitAmount() || 0;
        var creditAmount = line.getCreditAmount() || 0;
        var entityId = line.getEntityId();
        
        nlapiLogExecution('DEBUG', 'Line ' + i, 
            'Account: ' + accountId + ', Debit: ' + debitAmount + ', Credit: ' + creditAmount + ', Entity: ' + entityId);
        
        // Process ANY debit line with an entity
        if (debitAmount > 0 && entityId) {
            
            nlapiLogExecution('DEBUG', 'Processing Debit Line', 
                'Account: ' + accountId + ', Amount: ' + debitAmount + ', Entity: ' + entityId);
            
            // STEP 1: Create EXACT CARBON COPY as CREDIT to wash out original
            var washoutCredit = customLines.addNewLine();
            copyAllLineProperties(line, washoutCredit, 'credit', debitAmount);
            washoutCredit.setMemo('Washout debit to remove entity from subledger');
            
            // STEP 2: Create EXACT COPY as DEBIT but WITHOUT ENTITY
            var newDebit = customLines.addNewLine();
            copyAllLineProperties(line, newDebit, 'debit', debitAmount);
            newDebit.setMemo('Debit without entity - no aging impact');
            
            nlapiLogExecution('AUDIT', 'Line Processed', 
                'Washed out entity ' + entityId + ' from account ' + accountId + ' amount $' + debitAmount);
        }
    }
}

function copyAllLineProperties(sourceLine, targetLine, type, amount) {
    // Set account
    targetLine.setAccountId(sourceLine.getAccountId());
    
    // Set amount based on type
    if (type === 'credit') {
        targetLine.setCreditAmount(amount);
    } else {
        targetLine.setDebitAmount(amount);
    }
    
    // Copy entity (if this is the washout credit)
    if (type === 'credit' && sourceLine.getEntityId()) {
        targetLine.setEntityId(sourceLine.getEntityId());
    }
    // For debit, we intentionally skip entity
    
    // Copy all other dimensions
    try {
        if (sourceLine.getDepartmentId()) {
            targetLine.setDepartmentId(sourceLine.getDepartmentId());
        }
        if (sourceLine.getClassId()) {
            targetLine.setClassId(sourceLine.getClassId());
        }
        if (sourceLine.getLocationId()) {
            targetLine.setLocationId(sourceLine.getLocationId());
        }
    } catch (e) {
        nlapiLogExecution('DEBUG', 'Could not copy some properties', e.toString());
    }
}