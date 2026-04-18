/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define([], () => {
  function fieldChanged(context) {
    const { currentRecord, sublistId, fieldId } = context;

    // Only act on item sublist and when the cseg_npo_restrictn field changes
    if (sublistId === 'item' && fieldId === 'cseg_npo_restrictn') {
      const currentLine = currentRecord.getCurrentSublistIndex({ sublistId });

      if (currentLine === 0) {
        const lineValue = currentRecord.getCurrentSublistValue({
          sublistId,
          fieldId: 'cseg_npo_restrictn',
        });

        currentRecord.setValue({
          fieldId: 'cseg_npo_restrictn', // header-level field
          value: lineValue,
          ignoreFieldChange: true,
        });
      }
    }
  }

  return {
    fieldChanged,
  };
});