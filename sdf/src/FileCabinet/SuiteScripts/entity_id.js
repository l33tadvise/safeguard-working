/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/log'], function(record, log) {

  function afterSubmit(context) {
    if (context.type === context.UserEventType.DELETE) return;

    try {
      const rec = record.load({
        type: record.Type.CUSTOMER,
        id: context.newRecord.id
      });

      const legacyId = rec.getValue({ fieldId: 'custentity_pancan_legacy_record_id' }) || '';
      const first = rec.getValue({ fieldId: 'firstname' }) || '';
      const last = rec.getValue({ fieldId: 'lastname' }) || '';
      const company = rec.getValue({ fieldId: 'companyname' }) || '';

      if (!legacyId) {
        log.debug('Skipping update', 'No legacy ID present');
        return;
      }

      let namePart = '';

      if (!company && first && last) {
        namePart = `${first} ${last}`;
      } else if (company) {
        namePart = company;
      } else {
        log.debug('Skipping update', 'No usable name or company');
        return;
      }

      const finalId = `${legacyId} ${namePart}`;

      rec.setValue({
        fieldId: 'entityid',
        value: finalId
      });

      rec.save({
        enableSourcing: false,
        ignoreMandatoryFields: true
      });

      log.audit('Entity ID updated successfully', finalId);

    } catch (e) {
      log.error('Failed to update entityid', e);
    }
  }

  return {
    afterSubmit
  };
});