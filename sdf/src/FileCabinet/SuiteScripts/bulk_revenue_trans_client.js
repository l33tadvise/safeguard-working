/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * 
 * BULK REVENUE TRANSACTION CLIENT - EXACT COPY OF WORKING BULK PLEDGE PATTERN
 */
define(['N/currentRecord', 'N/ui/message'], (currentRecord, message) => {

  let intervalId;
  let processingMsg; // Store the processing message reference

  function pageInit(context) {
    console.log('Revenue Client script loaded');
    
    // Make functions globally available
    window.bulkAction = bulkAction;
    window.markAll = markAll;
    window.unmarkAll = unmarkAll;
    window.clearSearch = clearSearch;
    
    // Start monitoring checkbox changes every 250ms (4 times per second)
    intervalId = setInterval(updateSelectionSummary, 250);
    
    // Initial update
    setTimeout(updateSelectionSummary, 2000);
    
    // Don't try to add bulk selection controls - they're causing the CSS error
    // The Mark All/Unmark All buttons are already created by the suitelet
  }

  function markAll() {
    try {
      // Suppress the "leave site" popup
      window.onbeforeunload = null;
      
      // Find all checkboxes with better selector
      const checkboxes = document.querySelectorAll('input[type="checkbox"][name*="custpage_select"]');
      console.log('markAll: Found', checkboxes.length, 'checkboxes');
      
      let count = 0;
      checkboxes.forEach((checkbox, index) => {
        console.log(`Checkbox ${index}:`, checkbox.name, checkbox.checked);
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        count++;
      });
      
      console.log('markAll: Checked', count, 'checkboxes');
      updateSelectionSummary();
      showMessage(`Marked all ${count} records`, 'CONFIRMATION', 2500);
    } catch (e) {
      console.error('Error in markAll:', e);
      showMessage(`Error: ${e.message}`, 'ERROR');
    }
  }

  function unmarkAll() {
    try {
      // Suppress the "leave site" popup
      window.onbeforeunload = null;
      
      // Find all checkboxes with better selector
      const checkboxes = document.querySelectorAll('input[type="checkbox"][name*="custpage_select"]');
      console.log('unmarkAll: Found', checkboxes.length, 'checkboxes');
      
      let count = 0;
      checkboxes.forEach((checkbox, index) => {
        console.log(`Checkbox ${index}:`, checkbox.name, checkbox.checked);
        checkbox.checked = false;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        count++;
      });
      
      console.log('unmarkAll: Unchecked', count, 'checkboxes');
      updateSelectionSummary();
      showMessage(`Unmarked all ${count} records`, 'CONFIRMATION', 2500);
    } catch (e) {
      console.error('Error in unmarkAll:', e);
      showMessage(`Error: ${e.message}`, 'ERROR');
    }
  }

  function clearSearch() {
    try {
      // Suppress the "leave site" popup
      window.onbeforeunload = null;
      
      // EXACT COPY of your working bulk pledge pattern
      // Clear all filter fields except Sort By
      const fieldsToReset = [
        'custpage_date_from',
        'custpage_date_to', 
        'custpage_amount_from',
        'custpage_amount_to',
        'custpage_revenue_status',
        'custpage_customer'
      ];
      
      const current = currentRecord.get();
      
      fieldsToReset.forEach(fieldId => {
        try {
          current.setValue(fieldId, '');
        } catch (e) {
          // Some fields might not exist or be settable
        }
      });
      
      // Reset revenue status to "- All -"
      try {
        current.setValue('custpage_revenue_status', '');
      } catch (e) {
        // Field might not be settable
      }
      
      // Only unmark checkboxes if any are actually checked
      const checkedBoxes = document.querySelectorAll('input[type="checkbox"][name*="custpage_select"]:checked');
      if (checkedBoxes.length > 0) {
        checkedBoxes.forEach(checkbox => {
          checkbox.checked = false;
          checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        });
        
        // Force immediate update
        setTimeout(updateSelectionSummary, 100);
      }
      
      // Submit the form to refresh with cleared filters (EXACT COPY OF WORKING PATTERN)
      setTimeout(() => {
        // Suppress the "leave site" popup
        window.onbeforeunload = null;
        
        const mainForm = document.forms[0];
        if (mainForm) {
          mainForm.submit();
        }
      }, 500);
      
      showMessage('Search filters cleared', 'CONFIRMATION', 1000);
      
    } catch (e) {
      console.error('Error in clearSearch:', e);
      showMessage(`Error clearing search: ${e.message}`, 'ERROR');
    }
  }

  function updateSelectionSummary() {
    try {
      // Count from DOM checkboxes and get amounts from DOM
      const checkboxes = document.querySelectorAll('input[type="checkbox"][name*="custpage_select"]');
      let selectedCount = 0;
      let selectedAmount = 0;
      
      checkboxes.forEach(checkbox => {
        if (checkbox.checked) {
          selectedCount++;
          
          // Get amount from the same row - look in the AMOUNT column specifically
          const row = checkbox.closest('tr');
          if (row) {
            const cells = row.querySelectorAll('td');
            // The amount should be in the column before the last column (which is Revenue Status)
            // Look for the cell that contains currency format
            for (let i = 0; i < cells.length; i++) {
              const cell = cells[i];
              const text = cell.textContent.trim();
              // Look for currency format: number with commas and decimal
              if (text.match(/^\d{1,3}(,\d{3})*\.\d{2}$/)) {
                const amount = parseFloat(text.replace(/,/g, ''));
                selectedAmount += amount;
                console.log(`Found amount ${amount} in row`);
                break;
              }
            }
          }
        }
      });
      
      console.log(`Selection update: ${selectedCount} selected, total: ${selectedAmount}`);
      
      // Try to update NetSuite summary fields
      try {
        const current = currentRecord.get();
        current.setValue('custpage_selected_count', selectedCount);
        current.setValue('custpage_selected_amount', selectedAmount);
        console.log('Updated NetSuite fields successfully');
      } catch (e) {
        console.log('Could not update NetSuite fields:', e.message);
      }
      
      // Also try to update DOM fields directly as backup
      try {
        const countField = document.querySelector('input[name="custpage_selected_count"]');
        const amountField = document.querySelector('input[name="custpage_selected_amount"]');
        
        if (countField) countField.value = selectedCount;
        if (amountField) amountField.value = selectedAmount.toFixed(2);
      } catch (e) {
        console.log('Could not update DOM fields directly');
      }
      
    } catch (e) {
      console.error('Error in updateSelectionSummary:', e);
    }
  }

  function bulkAction(action) {
    console.log('bulkAction called with:', action);
    
    try {
      // MORE ROBUST: Get selected IDs using multiple strategies
      const checkboxes = document.querySelectorAll('input[type="checkbox"][name*="custpage_select"]:checked');
      const selectedIds = [];
      
      console.log(`Found ${checkboxes.length} checked checkboxes`);

      checkboxes.forEach((checkbox, index) => {
        const row = checkbox.closest('tr');
        if (!row) {
          console.warn(`Row ${index}: No parent row found`);
          return;
        }

        console.log(`Row ${index}: Processing row`, row);
        
        // Strategy 1: Look for hidden input with internal ID
        const hiddenId = row.querySelector('input[name*="custpage_internal_id"]');
        if (hiddenId && hiddenId.value) {
          selectedIds.push(hiddenId.value);
          console.log(`Row ${index}: Found hidden ID ${hiddenId.value}`);
          return;
        }

        // Strategy 2: Try using NetSuite record API
        try {
          const record = currentRecord.get();
          const lineCount = record.getLineCount({ sublistId: 'custpage_results' });
          console.log(`Total lines in record: ${lineCount}`);
          
          // Try to match this checkbox to a line number
          const checkboxName = checkbox.name;
          const lineMatch = checkboxName.match(/custpage_select(\d+)/);
          if (lineMatch) {
            const lineNum = parseInt(lineMatch[1]);
            if (lineNum < lineCount) {
              const internalId = record.getSublistValue({
                sublistId: 'custpage_results',
                fieldId: 'custpage_internal_id',
                line: lineNum
              });
              if (internalId) {
                selectedIds.push(internalId);
                console.log(`Row ${index}: Found ID from NetSuite API line ${lineNum}: ${internalId}`);
                return;
              }
            }
          }
        } catch (e) {
          console.log(`Row ${index}: NetSuite API failed:`, e.message);
        }

        // Strategy 3: Look in table cells for ID pattern
        const cells = row.querySelectorAll('td');
        console.log(`Row ${index}: Found ${cells.length} cells`);
        
        for (let i = 0; i < cells.length; i++) {
          const cell = cells[i];
          
          // Skip cells with HTML content (links)
          if (cell.querySelector('a')) {
            console.log(`Row ${index}, Cell ${i}: Skipping cell with links`);
            continue;
          }
          
          const text = cell.textContent.trim();
          console.log(`Row ${index}, Cell ${i}: Text content: "${text}"`);
          
          // Look for numeric ID pattern (should be a pure number, not currency)
          if (text && text.match(/^\d+$/) && text !== '0' && !text.includes('.')) {
            selectedIds.push(text);
            console.log(`Row ${index}: Found ID in cell ${i}: ${text}`);
            break;
          }
        }

        if (selectedIds.length === index) {
          console.warn(`Row ${index}: Could not find internal ID for this row`);
        }
      });

      console.log('Final selected IDs:', selectedIds);

      if (selectedIds.length === 0) {
        showMessage('No revenue transactions selected or could not find internal IDs. Check console for details.', 'WARNING');
        return;
      }

      // Professional confirmation dialog
      const actionText = getActionText(action);
      if (!confirm(`${actionText} for ${selectedIds.length} selected Revenue Transactions?\n\nThis action cannot be undone.`)) {
        return;
      }

      // Stop the interval during processing
      if (intervalId) clearInterval(intervalId);

      // Suppress the "leave site" popup
      window.onbeforeunload = null;

      // Professional processing message - use WARNING type for yellow/orange color like bulk pledge
      processingMsg = message.create({
        title: 'Processing',
        message: `${actionText} for ${selectedIds.length} revenue transactions...`,
        type: message.Type.WARNING  // Changed from INFORMATION to WARNING for yellow color
      });
      processingMsg.show();

      // Submit form (EXACT COPY of working pattern)
      const mainForm = document.forms[0];
      
      // Remove existing fields
      const existingAction = mainForm.querySelector('input[name="action"]');
      const existingIds = mainForm.querySelector('input[name="selected_ids"]');
      if (existingAction) existingAction.remove();
      if (existingIds) existingIds.remove();

      // Add new fields
      const actionField = document.createElement('input');
      actionField.type = 'hidden';
      actionField.name = 'action';
      actionField.value = action;
      mainForm.appendChild(actionField);

      const idsField = document.createElement('input');
      idsField.type = 'hidden';
      idsField.name = 'selected_ids';
      idsField.value = JSON.stringify(selectedIds);
      mainForm.appendChild(idsField);

      console.log('About to submit form with action:', action, 'and IDs:', JSON.stringify(selectedIds));
      mainForm.submit();

    } catch (e) {
      console.error('Error in bulkAction:', e);
      
      // Hide processing message if there was an error
      if (processingMsg) {
        processingMsg.hide();
      }
      
      showMessage(`Error: ${e.message}`, 'ERROR');
    }
  }

  // Get user-friendly action text
  function getActionText(action) {
    switch (action) {
      case 'post': return 'Posting Revenue Transactions';
      case 'void': return 'Voiding Revenue Transactions';
      case 'cancel': return 'Canceling Revenue Transactions';
      default: return 'Processing';
    }
  }

  function showMessage(text, type = 'CONFIRMATION', duration = 2000) {
    try {
      const msg = message.create({ 
        title: 'Revenue Transactions', 
        message: text, 
        type: message.Type[type] || message.Type.CONFIRMATION
      });
      msg.show({ duration: duration });
    } catch (e) {
      alert(text);
    }
  }

  return {
    pageInit: pageInit,
    bulkAction: bulkAction,
    markAll: markAll,
    unmarkAll: unmarkAll,
    clearSearch: clearSearch
  };
});