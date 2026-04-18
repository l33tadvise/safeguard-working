/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define(['N/currentRecord'], (currentRecord) => {

  function pageInit(context) {
    const rec = currentRecord.get();
    const entityId = rec.getValue({ fieldId: 'entityid' });

    // Prefill if empty
    if (!entityId) {
      rec.setValue({
        fieldId: 'entityid',
        value: 'Generated after Save'
      });
    }

    // Disable the field so it's read-only
    const field = rec.getField({ fieldId: 'entityid' });
    if (field) {
      field.isDisabled = true;
    }
  }

  return {
    pageInit
  };
});