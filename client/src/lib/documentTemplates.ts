
export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  content: string; // HTML with placeholders
  styles?: string; // Optional specific CSS
  type: 'report_card' | 'transfer_certificate' | 'payslip';
}


export const REPORT_TEMPLATES: DocumentTemplate[] = [
  {
    id: 'system-modern-dps',
    name: 'Single Term Report',
    description: 'Term-specific report card with professional header',
    type: 'report_card',
    content: `
      <div class="dps-indirapuram-container">
        <div class="border-outer">
            <div class="header" style="display: flex; align-items: center; justify-content: center; gap: 15px; margin-bottom: 20px;">
                <div class="school-logo" style="flex-shrink: 0;">{{logoSection}}</div>
                <div class="school-text" style="text-align: center;">
                    <h1>{{schoolName}}</h1>
                    <div class="school-info">
                        {{schoolAddress}}<br>
                        Phone: {{schoolPhone}} | Email: {{schoolEmail}}
                    </div>
                </div>
            </div>
            
            <hr style="margin: 10px 0; border: none; border-top: 1px solid #000;">
            <div style="text-align: center; margin-bottom: 15px;">
                <h2 style="font-size: 18px; margin: 5px 0;">ACADEMIC SESSION : {{session}}</h2>
                <h3 style="font-size: 16px; margin: 5px 0;">REPORT CARD</h3>
            </div>

            <table class="student-info" style="border: none; width: 100%; margin-top: 20px;">
                <tr style="border: none;">
                    <td style="border: none; width: 14%; text-align: left; font-weight: bold; padding: 12px 5px; white-space: nowrap;">Student's Name</td>
                    <td style="border: none; width: 1%; text-align: center; padding: 12px 5px;">:</td>
                    <td style="border: none; width: 50%; text-align: left; padding: 12px 5px; font-weight: bold;">{{studentName}}</td>
                    
                    <td style="border: none; width: 15%; text-align: left; font-weight: bold; padding: 12px 5px; white-space: nowrap;">Admission No.</td>
                    <td style="border: none; width: 1%; text-align: center; padding: 12px 5px;">:</td>
                    <td style="border: none; width: 19%; text-align: left; padding: 12px 5px; white-space: nowrap; font-weight: bold;">{{admissionNumber}}</td>
                </tr>
                <tr style="border: none;">
                    <td style="border: none; text-align: left; font-weight: bold; padding: 12px 5px; white-space: nowrap;">Father's Name</td>
                    <td style="border: none; text-align: center; padding: 12px 5px;">:</td>
                    <td style="border: none; text-align: left; padding: 12px 5px; font-weight: bold;">{{fatherName}}</td>
                    
                    <td style="border: none; text-align: left; font-weight: bold; padding: 12px 5px; white-space: nowrap;">Class & Section</td>
                    <td style="border: none; text-align: center; padding: 12px 5px;">:</td>
                    <td style="border: none; text-align: left; padding: 12px 5px; white-space: nowrap; font-weight: bold;">{{grade}} - {{section}}</td>
                </tr>
                <tr style="border: none;">
                    <td style="border: none; text-align: left; font-weight: bold; padding: 12px 5px; white-space: nowrap;">Mother's Name</td>
                    <td style="border: none; text-align: center; padding: 12px 5px;">:</td>
                    <td style="border: none; text-align: left; padding: 12px 5px; font-weight: bold;">{{motherName}}</td>
                    
                    <td style="border: none; text-align: left; font-weight: bold; padding: 12px 5px; white-space: nowrap;">Roll No.</td>
                    <td style="border: none; text-align: center; padding: 12px 5px;">:</td>
                    <td style="border: none; text-align: left; padding: 12px 5px; white-space: nowrap; font-weight: bold;">{{rollNumber}}</td>
                </tr>
                <tr style="border: none;">
                    <td style="border: none; text-align: left; font-weight: bold; padding: 12px 5px; white-space: nowrap;">Date of Birth</td>
                    <td style="border: none; text-align: center; padding: 12px 5px;">:</td>
                    <td style="border: none; text-align: left; padding: 12px 5px; font-weight: bold;">{{dob}}</td>
                    
                    <td style="border: none; text-align: left; padding: 12px 5px;"></td>
                    <td style="border: none; text-align: center; padding: 12px 5px;"></td>
                    <td style="border: none; text-align: left; padding: 12px 5px;"></td>
                </tr>
            </table>

            <div class="scholastic-area">
                {{gradesTableDPS}}
            </div>

            <div class="legend-wrapper" style="display: flex; justify-content: space-between; gap: 20px; margin-top: 20px;">
              <div class="table-container" style="flex: 1; border: 1px solid var(--theme-color, #000);">
                <div class="table-header" style="background-color: #f0f0f0; border-bottom: 1px solid var(--theme-color, #000); text-align: center; padding: 5px; font-weight: bold; font-size: 14px; -webkit-print-color-adjust: exact; color: var(--theme-color, #000);">Range & Division</div>
                <table style="width: 100%; border-collapse: collapse; border: none; margin: 0;">
                  <thead>
                    <tr>
                      <th style="border: 1px solid var(--theme-color, #000); padding: 8px; background: none;">Range</th>
                      <th style="border: 1px solid var(--theme-color, #000); padding: 8px; background: none;">Div.</th>
                    </tr>
                  </thead>
                  <tbody>
                     <tr><td style="border: 1px solid var(--theme-color, #000);">60% - 100%</td><td style="border: 1px solid var(--theme-color, #000);">First</td></tr>
                     <tr><td style="border: 1px solid var(--theme-color, #000);">45% - 59%</td><td style="border: 1px solid var(--theme-color, #000);">Second</td></tr>
                     <tr><td style="border: 1px solid var(--theme-color, #000);">33% - 44%</td><td style="border: 1px solid var(--theme-color, #000);">Third</td></tr>
                     <tr><td style="border: 1px solid var(--theme-color, #000);">Below 33%</td><td style="border: 1px solid var(--theme-color, #000);">Failed</td></tr>
                  </tbody>
                </table>
              </div>

              <div class="table-container" style="flex: 1; border: 1px solid var(--theme-color, #000);">
                <div class="table-header" style="background-color: #f0f0f0; border-bottom: 1px solid var(--theme-color, #000); text-align: center; padding: 5px; font-weight: bold; font-size: 14px; -webkit-print-color-adjust: exact; color: var(--theme-color, #000);">Key to Grade</div>
                <table style="width: 100%; border-collapse: collapse; border: none; margin: 0;">
                   <tbody>
                      <tr><td class="bold" style="border: 1px solid var(--theme-color, #000); padding: 2px 4px; font-weight: bold;">A1</td><td class="text-center" style="border: 1px solid var(--theme-color, #000); text-align: center; padding: 2px 4px;">Outstanding</td><td style="border: 1px solid var(--theme-color, #000); padding: 2px 4px;">91 - 100</td></tr>
                      <tr><td class="bold" style="border: 1px solid var(--theme-color, #000); padding: 2px 4px; font-weight: bold;">A2</td><td class="text-center" style="border: 1px solid var(--theme-color, #000); text-align: center; padding: 2px 4px;">Excellent</td><td style="border: 1px solid var(--theme-color, #000); padding: 2px 4px;">81 - 90</td></tr>
                      <tr><td class="bold" style="border: 1px solid var(--theme-color, #000); padding: 2px 4px; font-weight: bold;">B1</td><td class="text-center" style="border: 1px solid var(--theme-color, #000); text-align: center; padding: 2px 4px;">Very Good</td><td style="border: 1px solid var(--theme-color, #000); padding: 2px 4px;">71 - 80</td></tr>
                      <tr><td class="bold" style="border: 1px solid var(--theme-color, #000); padding: 2px 4px; font-weight: bold;">B2</td><td class="text-center" style="border: 1px solid var(--theme-color, #000); text-align: center; padding: 2px 4px;">Good</td><td style="border: 1px solid var(--theme-color, #000); padding: 2px 4px;">61 - 70</td></tr>
                      <tr><td class="bold" style="border: 1px solid var(--theme-color, #000); padding: 2px 4px; font-weight: bold;">C1</td><td class="text-center" style="border: 1px solid var(--theme-color, #000); text-align: center; padding: 2px 4px;">Above Average</td><td style="border: 1px solid var(--theme-color, #000); padding: 2px 4px;">51 - 60</td></tr>
                      <tr><td class="bold" style="border: 1px solid var(--theme-color, #000); padding: 2px 4px; font-weight: bold;">C2</td><td class="text-center" style="border: 1px solid var(--theme-color, #000); text-align: center; padding: 2px 4px;">Average</td><td style="border: 1px solid var(--theme-color, #000); padding: 2px 4px;">41 - 50</td></tr>
                      <tr><td class="bold" style="border: 1px solid var(--theme-color, #000); padding: 2px 4px; font-weight: bold;">D</td><td class="text-center" style="border: 1px solid var(--theme-color, #000); text-align: center; padding: 2px 4px;">Marginal</td><td style="border: 1px solid var(--theme-color, #000); padding: 2px 4px;">33 - 40</td></tr>
                      <tr><td class="bold" style="border: 1px solid var(--theme-color, #000); padding: 2px 4px; font-weight: bold;">E</td><td class="text-center" style="border: 1px solid var(--theme-color, #000); text-align: center; padding: 2px 4px;">Needs Improvement</td><td style="border: 1px solid var(--theme-color, #000); padding: 2px 4px;">Below 32</td></tr>
                   </tbody>
                </table>
              </div>
            </div>

            <div class="remarks">
                Class Teacher's Remarks : __________________________________________________________________
            </div>

            <p>Date: {{printDate}}</p>

            <div class="signatures">
                <div><br>Signature of Parent</div>
                <div><br>Signature of Class Teacher</div>
                <div><br>Signature of Principal</div>
            </div>

            <br><br>
        </div>
      </div>
    `,
    styles: `
        .dps-indirapuram-container { font-family: Arial, sans-serif; font-size: 11px; color: #000; font-weight: bold; }
        .border-outer { border: 3px double var(--theme-color, #000); padding: 10px; max-width: 800px; margin: auto; height: 280mm; display: flex; flex-direction: column; box-sizing: border-box; }
        .header { text-align: center; margin-bottom: 10px; }
        .header h1 { color: var(--theme-color, #d35400); font-size: 20px; margin: 0; text-transform: uppercase; font-weight: 800; }
        .header h2 { font-size: 16px; margin: 2px 0; font-weight: 700; color: var(--theme-color, #000); }
        .header h3 { font-size: 14px; margin: 2px 0; font-weight: 700; color: var(--theme-color, #000); }
        .school-info { font-size: 10px; margin-bottom: 5px; font-weight: 600; }
        
        .student-info { width: 100%; margin-bottom: 10px; border-collapse: collapse; }
        .student-info td { padding: 2px 0; vertical-align: top; }
        
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-weight: bold; }
        table, th, td { border: 1px solid var(--theme-color, #000); }
        th, td { padding: 3px; text-align: center; font-size: 11px; color: #000 !important; }
        .left-align { text-align: left; }
        
        .scholastic-area { flex-grow: 1; }
        .scholastic-area th { background-color: #f2f2f2; color: var(--theme-color, #000); font-weight: 800; }
        
        .remarks { margin: 10px 0; font-weight: bold; margin-top: 15px; }
        .signatures { display: flex; justify-content: space-between; margin-top: auto; padding-bottom: 10px; text-align: center; font-weight: bold; font-size: 11px; }
        .grading-scale { width: 40%; margin: 10px auto; page-break-inside: avoid; }
        .grading-scale th { background-color: #f2f2f2; }
    `
  },
  {
    id: 'system-modern-dps-consolidated',
    name: 'Full Session Report',
    description: 'All-terms report card with professional header',
    type: 'report_card',
    content: `
      <div class="dps-indirapuram-container">
        <div class="border-outer">
            <div class="header" style="display: flex; align-items: center; justify-content: center; gap: 15px; margin-bottom: 20px;">
                <div class="school-logo" style="flex-shrink: 0;">{{logoSection}}</div>
                <div class="school-text" style="text-align: center;">
                    <h1>{{schoolName}}</h1>
                    <div class="school-info">
                        {{schoolAddress}}<br>
                        Phone: {{schoolPhone}} | Email: {{schoolEmail}}
                    </div>
                </div>
            </div>
            
            <hr style="margin: 10px 0; border: none; border-top: 1px solid #000;">
            
            <div style="text-align: center; margin-bottom: 15px;">
                <h2 style="font-size: 18px; margin: 5px 0;">ACADEMIC SESSION : {{session}}</h2>
                <h3 style="font-size: 16px; margin: 5px 0;">REPORT CARD</h3>
            </div>

            <table class="student-info" style="border: none; width: 100%; margin-top: 20px;">
                <tr style="border: none;">
                    <td style="border: none; width: 14%; text-align: left; font-weight: bold; padding: 12px 5px; white-space: nowrap;">Student's Name</td>
                    <td style="border: none; width: 1%; text-align: center; padding: 12px 5px;">:</td>
                    <td style="border: none; width: 50%; text-align: left; padding: 12px 5px; font-weight: bold;">{{studentName}}</td>
                    
                    <td style="border: none; width: 15%; text-align: left; font-weight: bold; padding: 12px 5px; white-space: nowrap;">Admission No.</td>
                    <td style="border: none; width: 1%; text-align: center; padding: 12px 5px;">:</td>
                    <td style="border: none; width: 19%; text-align: left; padding: 12px 5px; white-space: nowrap; font-weight: bold;">{{admissionNumber}}</td>
                </tr>
                <tr style="border: none;">
                    <td style="border: none; text-align: left; font-weight: bold; padding: 12px 5px; white-space: nowrap;">Father's Name</td>
                    <td style="border: none; text-align: center; padding: 12px 5px;">:</td>
                    <td style="border: none; text-align: left; padding: 12px 5px; font-weight: bold;">{{fatherName}}</td>
                    
                    <td style="border: none; text-align: left; font-weight: bold; padding: 12px 5px; white-space: nowrap;">Class & Section</td>
                    <td style="border: none; text-align: center; padding: 12px 5px;">:</td>
                    <td style="border: none; text-align: left; padding: 12px 5px; white-space: nowrap; font-weight: bold;">{{grade}} - {{section}}</td>
                </tr>
                <tr style="border: none;">
                    <td style="border: none; text-align: left; font-weight: bold; padding: 12px 5px; white-space: nowrap;">Mother's Name</td>
                    <td style="border: none; text-align: center; padding: 12px 5px;">:</td>
                    <td style="border: none; text-align: left; padding: 12px 5px; font-weight: bold;">{{motherName}}</td>
                    
                    <td style="border: none; text-align: left; font-weight: bold; padding: 12px 5px; white-space: nowrap;">Roll No.</td>
                    <td style="border: none; text-align: center; padding: 12px 5px;">:</td>
                    <td style="border: none; text-align: left; padding: 12px 5px; white-space: nowrap; font-weight: bold;">{{rollNumber}}</td>
                </tr>
                <tr style="border: none;">
                    <td style="border: none; text-align: left; font-weight: bold; padding: 12px 5px; white-space: nowrap;">Date of Birth</td>
                    <td style="border: none; text-align: center; padding: 12px 5px;">:</td>
                    <td style="border: none; text-align: left; padding: 12px 5px; font-weight: bold;">{{dob}}</td>
                    
                    <td style="border: none; text-align: left; padding: 12px 5px;"></td>
                    <td style="border: none; text-align: center; padding: 12px 5px;"></td>
                    <td style="border: none; text-align: left; padding: 12px 5px;"></td>
                </tr>
            </table>

            <div class="scholastic-area">
                {{gradesTableConsolidated}}
            </div>

            <div class="legend-wrapper" style="display: flex; justify-content: space-between; gap: 20px; margin-top: 20px;">
              <div class="table-container" style="flex: 1; border: 1px solid var(--theme-color, #000);">
                <div class="table-header" style="background-color: #f0f0f0; border-bottom: 1px solid var(--theme-color, #000); text-align: center; padding: 5px; font-weight: bold; font-size: 14px; -webkit-print-color-adjust: exact; color: var(--theme-color, #000);">Range & Division</div>
                <table style="width: 100%; border-collapse: collapse; border: none; margin: 0;">
                  <thead>
                    <tr>
                      <th style="border: 1px solid var(--theme-color, #000); padding: 8px; background: none;">Range</th>
                      <th style="border: 1px solid var(--theme-color, #000); padding: 8px; background: none;">Div.</th>
                    </tr>
                  </thead>
                  <tbody>
                     <tr><td style="border: 1px solid var(--theme-color, #000);">60% - 100%</td><td style="border: 1px solid var(--theme-color, #000);">First</td></tr>
                     <tr><td style="border: 1px solid var(--theme-color, #000);">45% - 59%</td><td style="border: 1px solid var(--theme-color, #000);">Second</td></tr>
                     <tr><td style="border: 1px solid var(--theme-color, #000);">33% - 44%</td><td style="border: 1px solid var(--theme-color, #000);">Third</td></tr>
                     <tr><td style="border: 1px solid var(--theme-color, #000);">Below 33%</td><td style="border: 1px solid var(--theme-color, #000);">Failed</td></tr>
                  </tbody>
                </table>
              </div>

              <div class="table-container" style="flex: 1; border: 1px solid var(--theme-color, #000);">
                <div class="table-header" style="background-color: #f0f0f0; border-bottom: 1px solid var(--theme-color, #000); text-align: center; padding: 5px; font-weight: bold; font-size: 14px; -webkit-print-color-adjust: exact; color: var(--theme-color, #000);">Key to Grade</div>
                <table style="width: 100%; border-collapse: collapse; border: none; margin: 0;">
                   <tbody>
                      <tr><td class="bold" style="border: 1px solid var(--theme-color, #000); padding: 2px 4px; font-weight: bold;">A1</td><td class="text-center" style="border: 1px solid var(--theme-color, #000); text-align: center; padding: 2px 4px;">Outstanding</td><td style="border: 1px solid var(--theme-color, #000); padding: 2px 4px;">91 - 100</td></tr>
                      <tr><td class="bold" style="border: 1px solid var(--theme-color, #000); padding: 2px 4px; font-weight: bold;">A2</td><td class="text-center" style="border: 1px solid var(--theme-color, #000); text-align: center; padding: 2px 4px;">Excellent</td><td style="border: 1px solid var(--theme-color, #000); padding: 2px 4px;">81 - 90</td></tr>
                      <tr><td class="bold" style="border: 1px solid var(--theme-color, #000); padding: 2px 4px; font-weight: bold;">B1</td><td class="text-center" style="border: 1px solid var(--theme-color, #000); text-align: center; padding: 2px 4px;">Very Good</td><td style="border: 1px solid var(--theme-color, #000); padding: 2px 4px;">71 - 80</td></tr>
                      <tr><td class="bold" style="border: 1px solid var(--theme-color, #000); padding: 2px 4px; font-weight: bold;">B2</td><td class="text-center" style="border: 1px solid var(--theme-color, #000); text-align: center; padding: 2px 4px;">Good</td><td style="border: 1px solid var(--theme-color, #000); padding: 2px 4px;">61 - 70</td></tr>
                      <tr><td class="bold" style="border: 1px solid var(--theme-color, #000); padding: 2px 4px; font-weight: bold;">C1</td><td class="text-center" style="border: 1px solid var(--theme-color, #000); text-align: center; padding: 2px 4px;">Above Average</td><td style="border: 1px solid var(--theme-color, #000); padding: 2px 4px;">51 - 60</td></tr>
                      <tr><td class="bold" style="border: 1px solid var(--theme-color, #000); padding: 2px 4px; font-weight: bold;">C2</td><td class="text-center" style="border: 1px solid var(--theme-color, #000); text-align: center; padding: 2px 4px;">Average</td><td style="border: 1px solid var(--theme-color, #000); padding: 2px 4px;">41 - 50</td></tr>
                      <tr><td class="bold" style="border: 1px solid var(--theme-color, #000); padding: 2px 4px; font-weight: bold;">D</td><td class="text-center" style="border: 1px solid var(--theme-color, #000); text-align: center; padding: 2px 4px;">Marginal</td><td style="border: 1px solid var(--theme-color, #000); padding: 2px 4px;">33 - 40</td></tr>
                      <tr><td class="bold" style="border: 1px solid var(--theme-color, #000); padding: 2px 4px; font-weight: bold;">E</td><td class="text-center" style="border: 1px solid var(--theme-color, #000); text-align: center; padding: 2px 4px;">Needs Improvement</td><td style="border: 1px solid var(--theme-color, #000); padding: 2px 4px;">Below 32</td></tr>
                   </tbody>
                </table>
              </div>
            </div>

            <div class="remarks">
                Class Teacher's Remarks : __________________________________________________________________
            </div>

            <p>Date: {{printDate}}</p>

            <div class="signatures">
                <div><br>Signature of Parent</div>
                <div><br>Signature of Class Teacher</div>
                <div><br>Signature of Principal</div>
            </div>

            <br><br>
        </div>
      </div>
    `,
    styles: `
        .dps-indirapuram-container { font-family: Arial, sans-serif; font-size: 11px; color: #000; font-weight: bold; }
        .border-outer { border: 3px double var(--theme-color, #000); padding: 10px; max-width: 800px; margin: auto; height: 280mm; display: flex; flex-direction: column; box-sizing: border-box; }
        .header { text-align: center; margin-bottom: 10px; }
        .header h1 { color: var(--theme-color, #d35400); font-size: 20px; margin: 0; text-transform: uppercase; font-weight: 800; }
        .header h2 { font-size: 16px; margin: 2px 0; font-weight: 700; color: var(--theme-color, #000); }
        .header h3 { font-size: 14px; margin: 2px 0; font-weight: 700; color: var(--theme-color, #000); }
        .school-info { font-size: 10px; margin-bottom: 5px; font-weight: 600; }
        
        .student-info { width: 100%; margin-bottom: 10px; border-collapse: collapse; }
        .student-info td { padding: 2px 0; vertical-align: top; }
        
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-weight: bold; }
        table, th, td { border: 1px solid var(--theme-color, #000); }
        th, td { padding: 3px; text-align: center; font-size: 11px; color: #000 !important; }
        .left-align { text-align: left; }
        
        .scholastic-area { flex-grow: 1; }
        .scholastic-area th { background-color: #f2f2f2; color: var(--theme-color, #000); font-weight: 800; }
        
        .remarks { margin: 10px 0; font-weight: bold; margin-top: 15px; }
        .signatures { display: flex; justify-content: space-between; margin-top: auto; padding-bottom: 10px; text-align: center; font-weight: bold; font-size: 11px; }
        .grading-scale { width: 40%; margin: 10px auto; page-break-inside: avoid; }
        .grading-scale th { background-color: #f2f2f2; }
    `
  }
];

export const TC_TEMPLATES: DocumentTemplate[] = [];

export const getAllTemplates = () => [...REPORT_TEMPLATES];
export const getTemplateById = (id: string) => getAllTemplates().find(t => t.id === id);
