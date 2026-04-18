/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */

define(['N/ui/serverWidget', 'N/search', 'N/log'], function(serverWidget, search, log) {
    
    function calculateFiscalYearDates(asOfDateStr) {
        var asOf = new Date(asOfDateStr);
        var asOfYear = asOf.getFullYear();
        var asOfMonth = asOf.getMonth();
        
        var fyStartYear, fyEndYear;
        
        if (asOfMonth >= 6) {
            fyStartYear = asOfYear;
            fyEndYear = asOfYear + 1;
        } else {
            fyStartYear = asOfYear - 1;
            fyEndYear = asOfYear;
        }
        
        var fyStart = '07/01/' + fyStartYear;
        var fyEnd = '06/30/' + fyEndYear;
        var priorFyEnd = '06/30/' + fyStartYear;
        var asOfFormatted = formatDateForFormula(asOf);
        
        return {
            fyStart: fyStart,
            fyEnd: fyEnd,
            priorFyEnd: priorFyEnd,
            asOfDate: asOfFormatted
        };
    }
    
    function formatDateForFormula(date) {
        var month = (date.getMonth() + 1).toString();
        var day = date.getDate().toString();
        var year = date.getFullYear();
        
        if (month.length === 1) month = '0' + month;
        if (day.length === 1) day = '0' + day;
        
        return month + '/' + day + '/' + year;
    }
    
    function formatAccounting(value) {
        if (!value || value === '0' || value === 0) return '0.00';
        var num = parseFloat(value);
        var isNegative = num < 0;
        num = Math.abs(num);
        
        var formatted = num.toFixed(2);
        var parts = formatted.split('.');
        var integerPart = parts[0];
        var decimalPart = parts[1];
        
        var result = '';
        var len = integerPart.length;
        for (var i = 0; i < len; i++) {
            if (i > 0 && (len - i) % 3 === 0) {
                result += ',';
            }
            result += integerPart.charAt(i);
        }
        
        formatted = result + '.' + decimalPart;
        return isNegative ? '(' + formatted + ')' : formatted;
    }
    
    function createDynamicSearch(dates) {
        var filters = [
            ['accounttype', 'anyof', 'Equity', 'Income', 'COGS', 'Expense', 'OthIncome', 'OthExpense', '@NONE@'],
            'AND',
            ['type', 'noneof', 'ItemShip'],
            'AND',
            ['class', 'noneof', '@NONE@', '3', '5', '19', '20', '21', '17'],
            'AND',
            ['trandate', 'onorbefore', dates.asOfDate]
        ];
        
        var columns = [
            search.createColumn({ 
                name: 'class', 
                summary: search.Summary.GROUP 
            }),
            search.createColumn({ 
                name: 'formulacurrency', 
                summary: search.Summary.SUM, 
                formula: "NVL(CASE WHEN {posting} = 'T' AND {trandate} <= TO_DATE('" + dates.priorFyEnd + "', 'MM/DD/YYYY') AND {account.externalid} = '3080' THEN {amount} ELSE 0 END, 0)"
            }),
            search.createColumn({ 
                name: 'formulacurrency', 
                summary: search.Summary.SUM, 
                formula: "NVL(CASE WHEN {posting} = 'T' AND {trandate} >= TO_DATE('" + dates.fyStart + "', 'MM/DD/YYYY') AND {trandate} <= TO_DATE('" + dates.asOfDate + "', 'MM/DD/YYYY') AND {accounttype} IN ('Revenue', 'Other Revenue') AND {line.cseg_npo_restrictn} = 'With Donor Restrictions' THEN {amount} ELSE 0 END, 0)"
            }),
            search.createColumn({ 
                name: 'formulacurrency', 
                summary: search.Summary.SUM, 
                formula: "NVL(CASE WHEN {trandate} >= TO_DATE('" + dates.fyStart + "', 'MM/DD/YYYY') AND {trandate} <= TO_DATE('" + dates.asOfDate + "', 'MM/DD/YYYY') AND {type} = 'Release from Restriction' THEN -{debitamount} ELSE 0 END, 0)"
            }),
            search.createColumn({ 
                name: 'formulacurrency', 
                summary: search.Summary.SUM, 
                formula: "NVL(CASE WHEN {posting} = 'T' AND {trandate} <= TO_DATE('" + dates.priorFyEnd + "', 'MM/DD/YYYY') AND {account.externalid} = '3080' THEN {amount} ELSE 0 END, 0) + NVL(CASE WHEN {posting} = 'T' AND {trandate} >= TO_DATE('" + dates.fyStart + "', 'MM/DD/YYYY') AND {trandate} <= TO_DATE('" + dates.asOfDate + "', 'MM/DD/YYYY') AND {accounttype} IN ('Revenue', 'Other Revenue') AND {line.cseg_npo_restrictn} = 'With Donor Restrictions' THEN {amount} ELSE 0 END, 0) - NVL(CASE WHEN {posting} = 'T' AND {trandate} >= TO_DATE('" + dates.fyStart + "', 'MM/DD/YYYY') AND {trandate} <= TO_DATE('" + dates.asOfDate + "', 'MM/DD/YYYY') AND {type} = 'Release from Restriction' THEN {debitamount} ELSE 0 END, 0)"
            }),
            search.createColumn({ 
                name: 'formulacurrency', 
                summary: search.Summary.SUM, 
                formula: "NVL(CASE WHEN ({custrecord_linked_pledge_order.custrecord_ps_installment_date} > TO_DATE('" + dates.fyEnd + "', 'MM/DD/YYYY') OR {custrecord_linked_pledge_order.custrecord_ps_time_restriction} > TO_DATE('" + dates.fyEnd + "', 'MM/DD/YYYY')) AND {custrecord_linked_pledge_order.isinactive} = 'F' AND {custrecord_linked_pledge_order.custrecord_linked_pledge_date} <= TO_DATE('" + dates.fyEnd + "', 'MM/DD/YYYY') THEN -CASE WHEN {custrecord_linked_pledge_order.custrecord_ps_time_restriction} > TO_DATE('" + dates.fyEnd + "', 'MM/DD/YYYY') AND ({custrecord_linked_pledge_order.custrecord_ps_time_restriction} > {custrecord_linked_pledge_order.custrecord_ps_installment_date} OR {custrecord_linked_pledge_order.custrecord_ps_installment_date} IS NULL) THEN {custrecord_linked_pledge_order.custrecord_ps_installment_amt} ELSE {custrecord_linked_pledge_order.custrecord_installment_amt_remaining} END ELSE 0 END, 0)"
            }),
            search.createColumn({ 
                name: 'formulacurrency', 
                summary: search.Summary.SUM, 
                formula: "NVL(CASE WHEN {posting} = 'T' AND {trandate} <= TO_DATE('" + dates.priorFyEnd + "', 'MM/DD/YYYY') AND {account.externalid} = '3080' THEN {amount} ELSE 0 END, 0) + NVL(CASE WHEN {posting} = 'T' AND {trandate} >= TO_DATE('" + dates.fyStart + "', 'MM/DD/YYYY') AND {trandate} <= TO_DATE('" + dates.asOfDate + "', 'MM/DD/YYYY') AND {accounttype} IN ('Revenue', 'Other Revenue') AND {line.cseg_npo_restrictn} = 'With Donor Restrictions' THEN {amount} ELSE 0 END, 0) - NVL(CASE WHEN {posting} = 'T' AND {trandate} >= TO_DATE('" + dates.fyStart + "', 'MM/DD/YYYY') AND {trandate} <= TO_DATE('" + dates.asOfDate + "', 'MM/DD/YYYY') AND {type} = 'Release from Restriction' THEN {debitamount} ELSE 0 END, 0) - NVL(CASE WHEN ({custrecord_linked_pledge_order.custrecord_ps_installment_date} > TO_DATE('" + dates.fyEnd + "', 'MM/DD/YYYY') OR {custrecord_linked_pledge_order.custrecord_ps_time_restriction} > TO_DATE('" + dates.fyEnd + "', 'MM/DD/YYYY')) AND {custrecord_linked_pledge_order.isinactive} = 'F' AND {custrecord_linked_pledge_order.custrecord_linked_pledge_date} <= TO_DATE('" + dates.fyEnd + "', 'MM/DD/YYYY') THEN CASE WHEN {custrecord_linked_pledge_order.custrecord_ps_time_restriction} > TO_DATE('" + dates.fyEnd + "', 'MM/DD/YYYY') AND ({custrecord_linked_pledge_order.custrecord_ps_time_restriction} > {custrecord_linked_pledge_order.custrecord_ps_installment_date} OR {custrecord_linked_pledge_order.custrecord_ps_installment_date} IS NULL) THEN {custrecord_linked_pledge_order.custrecord_ps_installment_amt} ELSE {custrecord_linked_pledge_order.custrecord_installment_amt_remaining} END ELSE 0 END, 0)"
            })
        ];
        
        return search.create({
            type: 'transaction',
            filters: filters,
            columns: columns
        });
    }
    
    function onRequest(context) {
        try {
            if (context.request.method === 'GET') {
                var form = serverWidget.createForm({
                    title: 'Net Asset Rollforward Report'
                });
                
                var asOfDateField = form.addField({
                    id: 'custpage_asof_date',
                    type: serverWidget.FieldType.DATE,
                    label: 'As-of Date'
                });
                asOfDateField.isMandatory = true;
                
                form.addSubmitButton({
                    label: 'Generate Report'
                });
                
                context.response.writePage(form);
                
            } else if (context.request.method === 'POST') {
                var asOfDateParam = context.request.parameters.custpage_asof_date;
                
                if (!asOfDateParam) {
                    throw new Error('As-of date is required');
                }
                
                var dates = calculateFiscalYearDates(asOfDateParam);
                var dynamicSearch = createDynamicSearch(dates);
                var searchResults = [];
                
                var pagedData = dynamicSearch.runPaged({ pageSize: 1000 });
                
                for (var i = 0; i < pagedData.pageRanges.length; i++) {
                    var page = pagedData.fetch({ index: i });
                    page.data.forEach(function(result) {
                        var columns = dynamicSearch.columns;
                        searchResults.push({
                            program: result.getText(columns[0]) || 'Unclassified',
                            openingBalance: result.getValue(columns[1]) || 0,
                            fyRestrictedRevenue: result.getValue(columns[2]) || 0,
                            restrictedNAReleased: result.getValue(columns[3]) || 0,
                            endingBalance: result.getValue(columns[4]) || 0,
                            lessTimeRestricted: result.getValue(columns[5]) || 0,
                            endingBalanceEligible: result.getValue(columns[6]) || 0
                        });
                    });
                }
                
                var fyLabel = 'FY' + dates.fyEnd.substring(8, 10);
                
                var resultsForm = serverWidget.createForm({
                    title: 'Dynamic Net Asset Rollforward - Results'
                });
                
                var tableHtml = '';
                tableHtml += '<style>';
                tableHtml += 'body { font-family: Arial, sans-serif; }';
                tableHtml += '.report-title { text-align: center; font-size: 16px; font-weight: bold; color: #333; margin: 20px 0; }';
                tableHtml += '.params-box { background-color: #f0f0f0; padding: 15px; margin-bottom: 20px; border-radius: 5px; }';
                tableHtml += '.report-table { width: 100%; border-collapse: collapse; margin-top: 10px; }';
                tableHtml += '.report-table th { background-color: #e6e6e6; border: 1px solid #ccc; padding: 8px; font-weight: bold; text-align: left; }';
                tableHtml += '.report-table td { border: 1px solid #ccc; padding: 8px; }';
                tableHtml += '.report-table th.currency, .report-table td.currency { text-align: right; }';
                tableHtml += '.report-table .total-row { background-color: #f5f5f5; font-weight: bold; }';
                tableHtml += '.report-table .total-row td { border-top: 2px solid #333; }';
                tableHtml += '</style>';
                
                tableHtml += '<div class="report-title">PanCAN | Net Asset Rollforward by Program - ' + fyLabel + '</div>';
                
                tableHtml += '<div class="params-box">';
                tableHtml += '<strong>Report Parameters:</strong><br>';
                tableHtml += 'As-of Date: ' + dates.asOfDate + '<br>';
                tableHtml += 'Fiscal Year: ' + dates.fyStart + ' to ' + dates.fyEnd + '<br>';
                tableHtml += 'Prior FY End: ' + dates.priorFyEnd;
                tableHtml += '</div>';
                
                tableHtml += '<table class="report-table">';
                tableHtml += '<thead><tr>';
                tableHtml += '<th>PROGRAM</th>';
                tableHtml += '<th class="currency">OPENING BAL. RESTRICTED NA AS OF ' + dates.priorFyEnd + '</th>';
                tableHtml += '<th class="currency">' + fyLabel + ' RESTRICTED REVENUE</th>';
                tableHtml += '<th class="currency">RESTRICTED NA RELEASED IN ' + fyLabel + '</th>';
                tableHtml += '<th class="currency">' + fyLabel + ' ENDING RESTRICTED NA BAL.</th>';
                tableHtml += '<th class="currency">LESS TIME RESTRICTED</th>';
                tableHtml += '<th class="currency">' + fyLabel + ' ENDING RESTRICTED NA BAL. ELIGIBLE FOR RELEASE</th>';
                tableHtml += '</tr></thead><tbody>';
                
                var totals = {
                    openingBalance: 0,
                    fyRestrictedRevenue: 0,
                    restrictedNAReleased: 0,
                    endingBalance: 0,
                    lessTimeRestricted: 0,
                    endingBalanceEligible: 0
                };
                
                for (var j = 0; j < searchResults.length; j++) {
                    var result = searchResults[j];
                    
                    totals.openingBalance += parseFloat(result.openingBalance) || 0;
                    totals.fyRestrictedRevenue += parseFloat(result.fyRestrictedRevenue) || 0;
                    totals.restrictedNAReleased += parseFloat(result.restrictedNAReleased) || 0;
                    totals.endingBalance += parseFloat(result.endingBalance) || 0;
                    totals.lessTimeRestricted += parseFloat(result.lessTimeRestricted) || 0;
                    totals.endingBalanceEligible += parseFloat(result.endingBalanceEligible) || 0;
                    
                    tableHtml += '<tr>';
                    tableHtml += '<td>' + result.program + '</td>';
                    tableHtml += '<td class="currency">' + formatAccounting(result.openingBalance) + '</td>';
                    tableHtml += '<td class="currency">' + formatAccounting(result.fyRestrictedRevenue) + '</td>';
                    tableHtml += '<td class="currency">' + formatAccounting(result.restrictedNAReleased) + '</td>';
                    tableHtml += '<td class="currency">' + formatAccounting(result.endingBalance) + '</td>';
                    tableHtml += '<td class="currency">' + formatAccounting(result.lessTimeRestricted) + '</td>';
                    tableHtml += '<td class="currency">' + formatAccounting(result.endingBalanceEligible) + '</td>';
                    tableHtml += '</tr>';
                }
                
                tableHtml += '<tr class="total-row">';
                tableHtml += '<td><strong>Total</strong></td>';
                tableHtml += '<td class="currency"><strong>' + formatAccounting(totals.openingBalance) + '</strong></td>';
                tableHtml += '<td class="currency"><strong>' + formatAccounting(totals.fyRestrictedRevenue) + '</strong></td>';
                tableHtml += '<td class="currency"><strong>' + formatAccounting(totals.restrictedNAReleased) + '</strong></td>';
                tableHtml += '<td class="currency"><strong>' + formatAccounting(totals.endingBalance) + '</strong></td>';
                tableHtml += '<td class="currency"><strong>' + formatAccounting(totals.lessTimeRestricted) + '</strong></td>';
                tableHtml += '<td class="currency"><strong>' + formatAccounting(totals.endingBalanceEligible) + '</strong></td>';
                tableHtml += '</tr>';
                
                tableHtml += '</tbody></table>';
                
                resultsForm.addField({
                    id: 'custpage_report',
                    type: serverWidget.FieldType.INLINEHTML,
                    label: ' '
                }).defaultValue = tableHtml;
                
                resultsForm.addButton({
                    id: 'custpage_back',
                    label: 'Back to Input',
                    functionName: 'history.back()'
                });

              /*
                resultsForm.addButton({
                    id: 'custpage_export_csv',
                    label: 'Export to CSV',
                    functionName: 'exportCSV()'
                });
                */

                // Add CSV export functionality
                tableHtml += '<script>';
                tableHtml += 'function exportCSV() {';
                tableHtml += '  var xhr = new XMLHttpRequest();';
                tableHtml += '  var url = "/app/site/hosting/restlet.nl?script=customscript_csv_export&deploy=customdeploy_csv_export&asOfDate=" + encodeURIComponent("' + asOfDateParam + '");';
                tableHtml += '  xhr.open("GET", url, true);';
                tableHtml += '  xhr.onreadystatechange = function() {';
                tableHtml += '    if (xhr.readyState === 4 && xhr.status === 200) {';
                tableHtml += '      var csvData = xhr.responseText;';
                tableHtml += '      var blob = new Blob([csvData], {type: "text/csv"});';
                tableHtml += '      var link = document.createElement("a");';
                tableHtml += '      link.href = window.URL.createObjectURL(blob);';
                tableHtml += '      link.download = "Net_Asset_Rollforward_' + fyLabel + '.csv";';
                tableHtml += '      link.click();';
                tableHtml += '    } else if (xhr.readyState === 4) {';
                tableHtml += '      alert("Export failed. Status: " + xhr.status);';
                tableHtml += '    }';
                tableHtml += '  };';
                tableHtml += '  xhr.send();';
                tableHtml += '}';
                tableHtml += '</script>';
                
                context.response.writePage(resultsForm);
            }
            
        } catch (error) {
            log.error('Net Asset Rollforward Error', error.toString());
            
            var errorForm = serverWidget.createForm({
                title: 'Error'
            });
            
            errorForm.addField({
                id: 'custpage_error',
                type: serverWidget.FieldType.INLINEHTML,
                label: ' '
            }).defaultValue = '<div style="color: red; font-weight: bold;">Error: ' + error.toString() + '</div>';
            
            errorForm.addButton({
                id: 'custpage_back',
                label: 'Back',
                functionName: 'history.back()'
            });
            
            context.response.writePage(errorForm);
        }
    }
    
    return {
        onRequest: onRequest
    };
});