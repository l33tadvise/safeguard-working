/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define(['N/currentRecord', 'N/ui/message'], (currentRecord, message) => {

  let intervalId;
  let processingMsg; // Store the processing message reference

  function pageInit(context) {
    console.log('Client script loaded');
    
    // Make functions globally available
    window.bulkAction = bulkAction;
    window.markAll = markAll;
    window.unmarkAll = unmarkAll;
    window.clearSearch = clearSearch;
    
    // Start monitoring checkbox changes every 250ms (4 times per second)
    intervalId = setInterval(updateSelectionSummary, 250);
    
    // Initial update
    setTimeout(updateSelectionSummary, 2000);
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
      
      // Submit the form to refresh with cleared filters
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
          
          // Get amount from the same row
          const row = checkbox.closest('tr');
          if (row) {
            const cells = row.querySelectorAll('td');
            for (let cell of cells) {
              const text = cell.textContent.trim();
              // Look for currency format
              if (text.match(/^\d{1,3}(,\d{3})*\.\d{2}$/)) {
                const amount = parseFloat(text.replace(/,/g, ''));
                selectedAmount += amount;
                break;
              }
            }
          }
        }
      });
      
      // Try to update NetSuite summary fields if possible
      try {
        const current = currentRecord.get();
        current.setValue('custpage_selected_count', selectedCount);
        current.setValue('custpage_selected_amount', selectedAmount);
      } catch (e) {
        // If NetSuite record is broken, just ignore
      }
      
    } catch (e) {
      // Silently fail - this runs every 250ms
    }
  }

  function bulkAction(action) {
    console.log('bulkAction called with:', action);
    
    try {
      // FIXED: More robust DOM-based retrieval for internal IDs
      const checkboxes = document.querySelectorAll('input[type="checkbox"][name*="custpage_select"]:checked');
      const selectedIds = [];

      checkboxes.forEach((checkbox, index) => {
        const row = checkbox.closest('tr');
        if (!row) return;

        // Strategy 1: Look for hidden input with internal ID
        const hiddenId = row.querySelector('input[name*="custpage_internal_id"]');
        if (hiddenId && hiddenId.value) {
          selectedIds.push(hiddenId.value);
          console.log(`Row ${index}: Found hidden ID ${hiddenId.value}`);
          return;
        }

        // Strategy 2: Look in the last visible cell (internal ID column)
        const cells = row.querySelectorAll('td');
        for (let i = cells.length - 1; i >= 0; i--) {
          const cell = cells[i];
          
          // Skip cells with HTML content (links)
          if (cell.querySelector('a')) continue;
          
          const text = cell.textContent.trim();
          
          // Look for numeric ID pattern
          if (text && text.match(/^\d+$/) && text !== '0') {
            selectedIds.push(text);
            console.log(`Row ${index}: Found ID in cell ${i}: ${text}`);
            break;
          }
        }

        // Strategy 3: Look for data attributes
        const idFromAttr = row.dataset.internalId || row.getAttribute('data-id');
        if (idFromAttr) {
          selectedIds.push(idFromAttr);
          console.log(`Row ${index}: Found ID from attribute: ${idFromAttr}`);
          return;
        }

        // Strategy 4: Extract from checkbox name pattern
        const checkboxName = checkbox.name;
        const match = checkboxName.match(/custpage_select(\d+)/);
        if (match) {
          // Look for corresponding internal ID field
          const idFieldName = `custpage_internal_id${match[1]}`;
          const idField = document.querySelector(`input[name="${idFieldName}"]`);
          if (idField && idField.value) {
            selectedIds.push(idField.value);
            console.log(`Row ${index}: Found ID from field ${idFieldName}: ${idField.value}`);
            return;
          }
        }

        console.warn(`Row ${index}: Could not find internal ID`);
      });

      console.log('Found selected IDs from DOM:', selectedIds);

      if (selectedIds.length === 0) {
        showMessage('No orders selected or could not find internal IDs.', 'WARNING');
        return;
      }

      // **NEW: Professional confirmation dialog like single transaction**
      const actionText = getActionText(action);
      if (!confirm(`${actionText} for ${selectedIds.length} selected Pledge Orders?\n\nThis action cannot be undone.`)) {
        return;
      }

      // Stop the interval during processing
      if (intervalId) clearInterval(intervalId);

      // Suppress the "leave site" popup
      window.onbeforeunload = null;

      // **NEW: Professional processing message like single transaction**
      processingMsg = message.create({
        title: 'Processing',
        message: `${actionText} for ${selectedIds.length} orders...`,
        type: message.Type.INFORMATION
      });
      processingMsg.show();

      // Submit form
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

  // **NEW: Get user-friendly action text like single transaction**
  function getActionText(action) {
    switch (action) {
      case 'create': return 'Creating Revenue Postings';
      case 'hold': return 'Applying Revenue Hold';
      case 'release': return 'Releasing Revenue Hold';
      default: return 'Processing';
    }
  }

  function showMessage(text, type = 'CONFIRMATION', duration = 2000) {
    try {
      const msg = message.create({ 
        title: 'Pledge Orders', 
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