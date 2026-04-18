/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 * 
 * Revenue Transaction NPO Restriction User Event Script
 * 
 * Purpose: Automatically copy the NPO Restriction (cseg_npo_restrictn) from the first 
 *          line item to the header level when creating or editing revenue transactions.
 *          This ensures consistency between line-level and header-level restriction fields.
 * 
 * Applies To: Custom Transaction Type 110 (customsale_pledge_revenue_posting)
 * 
 * Deployment: 
 * - Record Type: Custom Transaction (customsale_pledge_revenue_posting)
 * - Event Types: Before Submit
 * - Execution Context: All
 * 
 * Author: NetSuite Development Team
 * Date: Current
 * Version: 1.0
 */

define(['N/log'], (log) => {
    
    /**
     * Executes before record is submitted (created or updated)
     * @param {Object} context - The context object
     * @param {Record} context.newRecord - The new record being saved
     * @param {Record} context.oldRecord - The old record (for edit operations)
     * @param {string} context.type - The operation type (create, edit, etc.)
     */
    function beforeSubmit(context) {
        try {
            // Only process CREATE and EDIT operations
            if (context.type !== context.UserEventType.CREATE && 
                context.type !== context.UserEventType.EDIT) {
                return;
            }
            
            const newRecord = context.newRecord;
            const recordType = newRecord.type;
            
            log.debug('NPO Restriction UE', `Processing ${context.type} operation for record type: ${recordType}`);
            
            // Check if this record has line items
            const lineCount = newRecord.getLineCount({ sublistId: 'item' });
            
            if (lineCount === 0) {
                log.debug('NPO Restriction UE', 'No line items found - skipping restriction sync');
                return;
            }
            
            // Get the NPO Restriction value from the first line item
            const firstLineRestriction = newRecord.getSublistValue({
                sublistId: 'item',
                fieldId: 'cseg_npo_restrictn',
                line: 0
            });
            
            // Get current header-level restriction
            const currentHeaderRestriction = newRecord.getValue({
                fieldId: 'cseg_npo_restrictn'
            });
            
            // Only update header if:
            // 1. First line has a restriction value, AND
            // 2. Header is different from first line (avoid unnecessary updates)
            if (firstLineRestriction && firstLineRestriction !== currentHeaderRestriction) {
                
                newRecord.setValue({
                    fieldId: 'cseg_npo_restrictn',
                    value: firstLineRestriction
                });
                
                log.debug('NPO Restriction UE', 
                    `Updated header restriction from "${currentHeaderRestriction}" to "${firstLineRestriction}"`);
                
            } else if (!firstLineRestriction && currentHeaderRestriction) {
                
                // Clear header restriction if first line is empty
                newRecord.setValue({
                    fieldId: 'cseg_npo_restrictn',
                    value: ''
                });
                
                log.debug('NPO Restriction UE', 
                    'Cleared header restriction (first line is empty)');
                
            } else {
                
                log.debug('NPO Restriction UE', 
                    'No restriction sync needed - values already match');
            }
            
        } catch (error) {
            // Log error but don't prevent record save
            log.error('NPO Restriction UE Error', {
                message: error.message,
                stack: error.stack,
                recordType: context.newRecord?.type,
                operationType: context.type
            });
        }
    }
    
    /**
     * Executes after record is submitted (optional - for logging/validation)
     * @param {Object} context - The context object
     */
    function afterSubmit(context) {
        try {
            // Only log for CREATE operations to confirm successful sync
            if (context.type === context.UserEventType.CREATE) {
                
                const newRecord = context.newRecord;
                const headerRestriction = newRecord.getValue({ fieldId: 'cseg_npo_restrictn' });
                const recordId = newRecord.id;
                
                log.audit('NPO Restriction UE', 
                    `Revenue Transaction ${recordId} created with header restriction: ${headerRestriction || '(none)'}`);
            }
            
        } catch (error) {
            log.error('NPO Restriction UE afterSubmit Error', {
                message: error.message,
                recordId: context.newRecord?.id
            });
        }
    }
    
    return {
        beforeSubmit: beforeSubmit,
        afterSubmit: afterSubmit
    };
});

/*
DEPLOYMENT INSTRUCTIONS:
========================

1. Script Record Setup:
   - Script ID: customscript_revenue_npo_restriction_ue
   - Name: Revenue Transaction NPO Restriction User Event
   - Script File: [upload this file]
   
2. Script Deployment:
   - Deployment ID: customdeploy_revenue_npo_restriction_ue
   - Applied To: Custom Transaction (customsale_pledge_revenue_posting)
   - Event Types: Before Submit, After Submit (optional)
   - Execution Context: All Contexts
   - Status: Released
   - Log Level: Debug (can change to Error for production)

3. Testing:
   - Create a revenue transaction manually with line items
   - Create a revenue transaction via Suitelet (individual)
   - Create revenue transactions via bulk Suitelet
   - Verify header cseg_npo_restrictn matches first line in all cases

4. Field Requirements:
   - Both header and line-level cseg_npo_restrictn fields must exist
   - Fields should be visible/accessible in the transaction form
   - Custom segment should be properly configured in NetSuite

5. Troubleshooting:
   - Check Script Execution Log for debug messages
   - Verify script is deployed to correct record type
   - Confirm field IDs match your NetSuite configuration
   - Test with different restriction values and empty values
*/