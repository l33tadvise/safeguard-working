/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define(['N/search'], function(search) {

  function fieldChanged(context) {
    var currentRecord = context.currentRecord;
    var sublistId = context.sublistId;
    var fieldId = context.fieldId;

    // Logic when Account is changed
    if (fieldId === 'account') {
      var accountId = currentRecord.getCurrentSublistValue({
        sublistId: sublistId,
        fieldId: 'account'
      });

      if (!accountId) return;

      try {
        var acctFields = search.lookupFields({
          type: 'account',
          id: accountId,
          columns: ['custrecord_default_program_acct']
        });

        var acctClass = acctFields.custrecord_default_program_acct;

        if (acctClass && acctClass.length > 0) {
          var classId = acctClass[0].value;

          currentRecord.setCurrentSublistValue({
            sublistId: sublistId,
            fieldId: 'class',
            value: classId,
            ignoreFieldChange: true
          });

          console.log('Set Class from Account default:', classId);
        } else {
          console.log('No default Class found on Account:', accountId);
        }

      } catch (e) {
        console.error('Error retrieving Account default:', e.name, e.message);
      }
    }

    // Logic when Department is changed
    if (fieldId === 'department') {
      var deptId = currentRecord.getCurrentSublistValue({
        sublistId: sublistId,
        fieldId: 'department'
      });

      if (!deptId) return;

      try {
        var deptFields = search.lookupFields({
          type: 'department',
          id: deptId,
          columns: ['custrecord_default_program_dept']
        });

        var deptClass = deptFields.custrecord_default_program_dept;

        if (deptClass && deptClass.length > 0) {
          var classId = deptClass[0].value;

          currentRecord.setCurrentSublistValue({
            sublistId: sublistId,
            fieldId: 'class',
            value: classId,
            ignoreFieldChange: true
          });

          console.log('Overrode Class from Department default:', classId);
        } else {
          console.log('Department default Class is blank. Class value not changed.');
        }

      } catch (e) {
        console.error('Error retrieving Department default:', e.name, e.message);
      }
    }
  }

  return {
    fieldChanged: fieldChanged
  };
});