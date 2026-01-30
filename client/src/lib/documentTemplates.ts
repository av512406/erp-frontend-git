
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
    id: 'system-default',
    name: 'Standard Format',
    description: 'Default comprehensive report card layout',
    type: 'report_card',
    content: `
      <div class="report-card">
        <div class="header">
          <div class="logo-section">{{logoSection}}</div>
          <div class="school-info">
            <h1>{{schoolName}}</h1>
            <p>{{schoolAddress}}</p>
            <p>Phone: {{schoolPhone}} | Email: {{schoolEmail}}</p>
          </div>
        </div>
        
        <div class="student-details">
          <h2>Report Card - {{session}}</h2>
          <table>
            <tr>
              <td><strong>Name:</strong> {{studentName}}</td>
              <td><strong>Admission No:</strong> {{admissionNumber}}</td>
            </tr>
            <tr>
              <td><strong>Class:</strong> {{grade}}</td>
              <td><strong>Roll No:</strong> {{rollNumber}}</td>
            </tr>
          </table>
        </div>

        <div class="grades-section">
          {{gradesTable}}
        </div>
        
        <div class="footer">
          <div class="signature">
            <div class="line"></div>
            <p>Class Teacher</p>
          </div>
          <div class="signature">
            <div class="line"></div>
            <p>Principal</p>
          </div>
        </div>
      </div>
    `,
    styles: `
      .report-card { padding: 30px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 800px; margin: 0 auto; color: #333; line-height: 1.5; }
      .header { display: flex; align-items: center; border-bottom: 3px solid #0056b3; padding-bottom: 25px; margin-bottom: 30px; background: linear-gradient(to bottom, #fff, #f8f9fa); }
      .logo-section { width: 120px; height: 120px; margin-right: 30px; display: flex; align-items: center; justify-content: center; }
      .logo-section img { max-width: 100%; max-height: 100%; object-fit: contain; }
      .school-info { flex: 1; text-align: center; }
      .school-info h1 { margin: 0 0 10px; color: #0056b3; font-size: 32px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
      .school-info p { margin: 4px 0; color: #555; font-size: 14px; }
      
      .student-details { margin-bottom: 35px; background: #fff; padding: 0; box-shadow: 0 2px 5px rgba(0,0,0,0.05); border: 1px solid #e1e4e8; border-radius: 8px; overflow: hidden; }
      .student-details h2 { background: #0056b3; color: white; margin: 0; padding: 12px 20px; font-size: 18px; text-transform: uppercase; letter-spacing: 0.5px; }
      .student-details table { width: 100%; border-collapse: collapse; margin: 15px 0; }
      .student-details td { padding: 10px 20px; border-bottom: 1px solid #f0f0f0; width: 50%; }
      .student-details tr:last-child td { border-bottom: none; }
      .student-details strong { color: #0056b3; display: inline-block; width: 120px; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px; }
      
      .grades-section table { width: 100%; border-collapse: collapse; margin-top: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
      .grades-section th { background-color: #0056b3; color: white; padding: 15px; text-align: left; font-weight: 600; text-transform: uppercase; font-size: 13px; letter-spacing: 0.5px; border: 1px solid #004494; }
      .grades-section td { padding: 12px 15px; border: 1px solid #e1e4e8; color: #444; }
      .grades-section tr:nth-child(even) { background-color: #f8f9fa; }
      .grades-section tr:hover { background-color: #f1f4f8; }
      
      .footer { display: flex; justify-content: space-between; margin-top: 60px; padding-top: 30px; border-top: 1px solid #eee; }
      .signature { text-align: center; width: 220px; }
      .signature .line { border-top: 2px solid #333; margin-bottom: 8px; width: 100%; transition: all 0.3s; }
      .signature p { font-weight: bold; font-size: 14px; text-transform: uppercase; color: #555; }
    `
  },
  {
    id: 'system-classic',
    name: 'Classic Style (St. Augustine)',
    description: 'Traditional formal layout with borders',
    type: 'report_card',
    content: `
      <div class="classic-report">
        <div class="border-frame">
          <div class="classic-header">
            {{logoSection}}
            <h1 class="school-name">{{schoolName}}</h1>
            <p class="address">{{schoolAddress}}</p>
          </div>
          
          <div class="report-title">ANNUAL PROGRESS REPORT</div>
          
          <div class="student-info-grid">
            <div class="info-row">
              <span class="label">Student Name:</span>
              <span class="value">{{studentName}}</span>
            </div>
            <div class="info-row">
              <span class="label">Class/Sec:</span>
              <span class="value">{{grade}}</span>
            </div>
            <div class="info-row">
              <span class="label">Roll No:</span>
              <span class="value">{{rollNumber}}</span>
            </div>
            <div class="info-row">
              <span class="label">Adm. No:</span>
              <span class="value">{{admissionNumber}}</span>
            </div>
          </div>

          <div class="marks-container">
            {{gradesTable}}
          </div>
          
          <div class="remarks-section">
            <p><strong>Remarks:</strong> ________________________________________________</p>
          </div>

          <div class="signatures-row">
            <div class="sig-box">Teacher's Sig.</div>
            <div class="sig-box">Parent's Sig.</div>
            <div class="sig-box">Principal's Sig.</div>
          </div>
        </div>
      </div>
    `,
    styles: `
      .classic-report { padding: 0; font-family: 'Times New Roman', Times, serif; }
      .border-frame { border: 3px solid #000; padding: 4px; height: 100%; box-sizing: border-box; }
      .classic-header { border: 1px solid #000; padding: 20px; text-align: center; margin-bottom: 20px; position: relative; }
      .classic-header::after { content: ''; display: block; width: 80%; height: 1px; background: #000; margin: 15px auto 0; }
      .logo-section { width: 100px; height: 100px; margin: 0 auto 15px; }
      .logo-section img { max-height: 100%; }
      
      .school-name { font-size: 34px; font-weight: 900; text-transform: uppercase; margin: 0; letter-spacing: 1px; line-height: 1.2; }
      .address { font-size: 14px; font-style: italic; margin-top: 5px; }
      
      .report-title { 
         text-align: center; font-size: 22px; font-weight: bold; text-decoration: underline; text-transform: uppercase; 
         margin: 25px 0; letter-spacing: 1px;
      }
      
      .student-info-grid { 
        display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; 
        border: 1px solid #000; padding: 20px; background: #fff;
      }
      .info-row { display: flex; border-bottom: 1px dotted #000; padding-bottom: 5px; align-items: flex-end; }
      .label { font-weight: bold; white-space: nowrap; margin-right: 10px; font-size: 14px; }
      .value { font-weight: 500; font-size: 16px; flex: 1; }
      
      .marks-container table { width: 100%; border-collapse: collapse; border: 2px solid #000; margin-bottom: 20px; }
      .marks-container th { border: 1px solid #000; background: #f0f0f0; padding: 12px 8px; font-weight: bold; text-transform: uppercase; font-size: 14px; }
      .marks-container td { border: 1px solid #000; padding: 10px 8px; text-align: center; font-size: 15px; }
      .marks-container tr:nth-last-child(1) { font-weight: bold; background: #f8f8f8; }
      
      .remarks-section { margin-top: 30px; padding: 15px; border: 1px solid #000; min-height: 50px; }
      
      .signatures-row { display: flex; justify-content: space-between; margin-top: 80px; padding: 0 40px; }
      .sig-box { border-top: 1px solid #000; padding-top: 10px; width: 180px; text-align: center; font-weight: bold; font-size: 14px; }
    `
  },
  {
    id: 'system-modern-dps',
    name: 'DPS Indirapuram Style',
    description: 'Format based on DPS Indirapuram Report Card',
    type: 'report_card',
    content: `
      <div class="dps-indirapuram-container">
        <div class="border-outer">
            <div class="header" style="display: flex; align-items: center; justify-content: center; gap: 15px; margin-bottom: 20px;">
                <div class="school-logo" style="flex-shrink: 0;">{{logoSection}}</div>
                <div class="school-text" style="text-align: center;">
                    <h1>{{schoolName}}</h1>
                    <!-- <h1>INDIRAPURAM</h1> -->
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
                    <td style="border: none; width: 50%; text-align: left; padding: 12px 5px;">{{studentName}}</td>
                    
                    <td style="border: none; width: 15%; text-align: left; font-weight: bold; padding: 12px 5px; white-space: nowrap;">Admission No.</td>
                    <td style="border: none; width: 1%; text-align: center; padding: 12px 5px;">:</td>
                    <td style="border: none; width: 19%; text-align: left; padding: 12px 5px; white-space: nowrap;">{{admissionNumber}}</td>
                </tr>
                <tr style="border: none;">
                    <td style="border: none; text-align: left; font-weight: bold; padding: 12px 5px; white-space: nowrap;">Father's Name</td>
                    <td style="border: none; text-align: center; padding: 12px 5px;">:</td>
                    <td style="border: none; text-align: left; padding: 12px 5px;">{{fatherName}}</td>
                    
                    <td style="border: none; text-align: left; font-weight: bold; padding: 12px 5px; white-space: nowrap;">Class & Section</td>
                    <td style="border: none; text-align: center; padding: 12px 5px;">:</td>
                    <td style="border: none; text-align: left; padding: 12px 5px; white-space: nowrap;">{{grade}} - {{section}}</td>
                </tr>
                <tr style="border: none;">
                    <td style="border: none; text-align: left; font-weight: bold; padding: 12px 5px; white-space: nowrap;">Mother's Name</td>
                    <td style="border: none; text-align: center; padding: 12px 5px;">:</td>
                    <td style="border: none; text-align: left; padding: 12px 5px;">{{motherName}}</td>
                    
                    <td style="border: none; text-align: left; font-weight: bold; padding: 12px 5px; white-space: nowrap;">Roll No.</td>
                    <td style="border: none; text-align: center; padding: 12px 5px;">:</td>
                    <td style="border: none; text-align: left; padding: 12px 5px; white-space: nowrap;">{{rollNumber}}</td>
                </tr>
                <tr style="border: none;">
                    <td style="border: none; text-align: left; font-weight: bold; padding: 12px 5px; white-space: nowrap;">Date of Birth</td>
                    <td style="border: none; text-align: center; padding: 12px 5px;">:</td>
                    <td style="border: none; text-align: left; padding: 12px 5px;">{{dob}}</td>
                    
                    <td style="border: none; text-align: left; padding: 12px 5px;"></td>
                    <td style="border: none; text-align: center; padding: 12px 5px;"></td>
                    <td style="border: none; text-align: left; padding: 12px 5px;"></td>
                </tr>
            </table>

            <div class="scholastic-area">
                {{gradesTableDPS}}
            </div>

            <div class="legend-wrapper" style="display: flex; justify-content: space-between; gap: 20px; margin-top: 20px;">
              <!-- Division Table -->
              <div class="table-container" style="flex: 1; border: 1px solid #000;">
                <div class="table-header" style="background-color: #d1d9e6; border-bottom: 1px solid #000; text-align: center; padding: 5px; font-weight: bold; font-size: 14px; -webkit-print-color-adjust: exact;">Range & Division</div>
                <table style="width: 100%; border-collapse: collapse; border: none; margin: 0;">
                  <thead>
                    <tr>
                      <th style="border: 1px solid #000; padding: 8px; background: none;">Range</th>
                      <th style="border: 1px solid #000; padding: 8px; background: none;">Div.</th>
                    </tr>
                  </thead>
                  <tbody>
                     <tr><td style="border: 1px solid #000;">60% - 100%</td><td style="border: 1px solid #000;">First</td></tr>
                     <tr><td style="border: 1px solid #000;">45% - 59%</td><td style="border: 1px solid #000;">Second</td></tr>
                     <tr><td style="border: 1px solid #000;">33% - 44%</td><td style="border: 1px solid #000;">Third</td></tr>
                     <tr><td style="border: 1px solid #000;">Below 33%</td><td style="border: 1px solid #000;">Failed</td></tr>
                  </tbody>
                </table>
              </div>

              <!-- Key to Grade Table -->
              <div class="table-container" style="flex: 1; border: 1px solid #000;">
                <div class="table-header" style="background-color: #d1d9e6; border-bottom: 1px solid #000; text-align: center; padding: 5px; font-weight: bold; font-size: 14px; -webkit-print-color-adjust: exact;">Key to Grade</div>
                <table style="width: 100%; border-collapse: collapse; border: none; margin: 0;">
                   <tbody>
                      <tr><td class="bold" style="border: 1px solid #000; padding: 2px 4px; font-weight: bold;">A1</td><td class="text-left" style="border: 1px solid #000; text-align: left; padding: 2px 4px;">Outstanding</td><td style="border: 1px solid #000; padding: 2px 4px;">-</td><td style="border: 1px solid #000; padding: 2px 4px;">91 - 100</td></tr>
                      <tr><td class="bold" style="border: 1px solid #000; padding: 2px 4px; font-weight: bold;">A2</td><td class="text-left" style="border: 1px solid #000; text-align: left; padding: 2px 4px;">Excellent</td><td style="border: 1px solid #000; padding: 2px 4px;">-</td><td style="border: 1px solid #000; padding: 2px 4px;">81 - 90</td></tr>
                      <tr><td class="bold" style="border: 1px solid #000; padding: 2px 4px; font-weight: bold;">B1</td><td class="text-left" style="border: 1px solid #000; text-align: left; padding: 2px 4px;">Very Good</td><td style="border: 1px solid #000; padding: 2px 4px;">-</td><td style="border: 1px solid #000; padding: 2px 4px;">71 - 80</td></tr>
                      <tr><td class="bold" style="border: 1px solid #000; padding: 2px 4px; font-weight: bold;">B2</td><td class="text-left" style="border: 1px solid #000; text-align: left; padding: 2px 4px;">Good</td><td style="border: 1px solid #000; padding: 2px 4px;">-</td><td style="border: 1px solid #000; padding: 2px 4px;">61 - 70</td></tr>
                      <tr><td class="bold" style="border: 1px solid #000; padding: 2px 4px; font-weight: bold;">C1</td><td class="text-left" style="border: 1px solid #000; text-align: left; padding: 2px 4px;">Above Average</td><td style="border: 1px solid #000; padding: 2px 4px;">-</td><td style="border: 1px solid #000; padding: 2px 4px;">51 - 60</td></tr>
                      <tr><td class="bold" style="border: 1px solid #000; padding: 2px 4px; font-weight: bold;">C2</td><td class="text-left" style="border: 1px solid #000; text-align: left; padding: 2px 4px;">Average</td><td style="border: 1px solid #000; padding: 2px 4px;">-</td><td style="border: 1px solid #000; padding: 2px 4px;">41 - 50</td></tr>
                      <tr><td class="bold" style="border: 1px solid #000; padding: 2px 4px; font-weight: bold;">D</td><td class="text-left" style="border: 1px solid #000; text-align: left; padding: 2px 4px;">Marginal</td><td style="border: 1px solid #000; padding: 2px 4px;">-</td><td style="border: 1px solid #000; padding: 2px 4px;">33 - 40</td></tr>
                      <tr><td class="bold" style="border: 1px solid #000; padding: 2px 4px; font-weight: bold;">E</td><td class="text-left" style="border: 1px solid #000; text-align: left; padding: 2px 4px;">Needs Improvement</td><td style="border: 1px solid #000; padding: 2px 4px;">-</td><td style="border: 1px solid #000; padding: 2px 4px;">Below 32</td></tr>
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
        .dps-indirapuram-container { font-family: Arial, sans-serif; font-size: 12px; color: #333; }
        .border-outer { border: 3px double #000; padding: 10px; max-width: 800px; margin: auto; min-height: 275mm; display: flex; flex-direction: column; box-sizing: border-box; }
        .header { text-align: center; margin-bottom: 20px; }
        .header h1 { color: #d35400; font-size: 24px; margin: 0; text-transform: uppercase; }
        .header h2 { font-size: 18px; margin: 5px 0; }
        .header h3 { font-size: 16px; margin: 5px 0; }
        .school-info { font-size: 11px; margin-bottom: 10px; }
        
        .student-info { width: 100%; margin-bottom: 15px; border-collapse: collapse; }
        .student-info td { padding: 4px 0; vertical-align: top; }
        
        table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
        table, th, td { border: 1px solid black; }
        th, td { padding: 6px; text-align: center; }
        .left-align { text-align: left; }
        
        .scholastic-area th { background-color: #f2f2f2; }
        
        .remarks { margin: 15px 0; font-weight: bold; margin-top: 40px; }
        .signatures { display: flex; justify-content: space-between; margin-top: auto; padding-bottom: 20px; text-align: center; }
        .grading-scale { width: 40%; margin: 20px auto; page-break-inside: avoid; }
        .grading-scale th { background-color: #f2f2f2; }
    `
  },
  {
    id: 'system-modern-dps-consolidated',
    name: 'DPS Indirapuram (Consolidated)',
    description: 'Consolidated report showing all terms',
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
                    <td style="border: none; width: 50%; text-align: left; padding: 12px 5px;">{{studentName}}</td>
                    
                    <td style="border: none; width: 15%; text-align: left; font-weight: bold; padding: 12px 5px; white-space: nowrap;">Admission No.</td>
                    <td style="border: none; width: 1%; text-align: center; padding: 12px 5px;">:</td>
                    <td style="border: none; width: 19%; text-align: left; padding: 12px 5px; white-space: nowrap;">{{admissionNumber}}</td>
                </tr>
                <tr style="border: none;">
                    <td style="border: none; text-align: left; font-weight: bold; padding: 12px 5px; white-space: nowrap;">Father's Name</td>
                    <td style="border: none; text-align: center; padding: 12px 5px;">:</td>
                    <td style="border: none; text-align: left; padding: 12px 5px;">{{fatherName}}</td>
                    
                    <td style="border: none; text-align: left; font-weight: bold; padding: 12px 5px; white-space: nowrap;">Class & Section</td>
                    <td style="border: none; text-align: center; padding: 12px 5px;">:</td>
                    <td style="border: none; text-align: left; padding: 12px 5px; white-space: nowrap;">{{grade}} - {{section}}</td>
                </tr>
                <tr style="border: none;">
                    <td style="border: none; text-align: left; font-weight: bold; padding: 12px 5px; white-space: nowrap;">Mother's Name</td>
                    <td style="border: none; text-align: center; padding: 12px 5px;">:</td>
                    <td style="border: none; text-align: left; padding: 12px 5px;">{{motherName}}</td>
                    
                    <td style="border: none; text-align: left; font-weight: bold; padding: 12px 5px; white-space: nowrap;">Roll No.</td>
                    <td style="border: none; text-align: center; padding: 12px 5px;">:</td>
                    <td style="border: none; text-align: left; padding: 12px 5px; white-space: nowrap;">{{rollNumber}}</td>
                </tr>
                <tr style="border: none;">
                    <td style="border: none; text-align: left; font-weight: bold; padding: 12px 5px; white-space: nowrap;">Date of Birth</td>
                    <td style="border: none; text-align: center; padding: 12px 5px;">:</td>
                    <td style="border: none; text-align: left; padding: 12px 5px;">{{dob}}</td>
                    
                    <td style="border: none; text-align: left; padding: 12px 5px;"></td>
                    <td style="border: none; text-align: center; padding: 12px 5px;"></td>
                    <td style="border: none; text-align: left; padding: 12px 5px;"></td>
                </tr>
            </table>

            <div class="scholastic-area">
                {{gradesTableConsolidated}}
            </div>

            <div class="legend-wrapper" style="display: flex; justify-content: space-between; gap: 20px; margin-top: 20px;">
              <div class="table-container" style="flex: 1; border: 1px solid #000;">
                <div class="table-header" style="background-color: #d1d9e6; border-bottom: 1px solid #000; text-align: center; padding: 5px; font-weight: bold; font-size: 14px; -webkit-print-color-adjust: exact;">Range & Division</div>
                <table style="width: 100%; border-collapse: collapse; border: none; margin: 0;">
                  <thead>
                    <tr>
                      <th style="border: 1px solid #000; padding: 8px; background: none;">Range</th>
                      <th style="border: 1px solid #000; padding: 8px; background: none;">Div.</th>
                    </tr>
                  </thead>
                  <tbody>
                     <tr><td style="border: 1px solid #000;">60% - 100%</td><td style="border: 1px solid #000;">First</td></tr>
                     <tr><td style="border: 1px solid #000;">45% - 59%</td><td style="border: 1px solid #000;">Second</td></tr>
                     <tr><td style="border: 1px solid #000;">33% - 44%</td><td style="border: 1px solid #000;">Third</td></tr>
                     <tr><td style="border: 1px solid #000;">Below 33%</td><td style="border: 1px solid #000;">Failed</td></tr>
                  </tbody>
                </table>
              </div>

              <div class="table-container" style="flex: 1; border: 1px solid #000;">
                <div class="table-header" style="background-color: #d1d9e6; border-bottom: 1px solid #000; text-align: center; padding: 5px; font-weight: bold; font-size: 14px; -webkit-print-color-adjust: exact;">Key to Grade</div>
                <table style="width: 100%; border-collapse: collapse; border: none; margin: 0;">
                   <tbody>
                      <tr><td class="bold" style="border: 1px solid #000; padding: 2px 4px; font-weight: bold;">A1</td><td class="text-left" style="border: 1px solid #000; text-align: left; padding: 2px 4px;">Outstanding</td><td style="border: 1px solid #000; padding: 2px 4px;">-</td><td style="border: 1px solid #000; padding: 2px 4px;">91 - 100</td></tr>
                      <tr><td class="bold" style="border: 1px solid #000; padding: 2px 4px; font-weight: bold;">A2</td><td class="text-left" style="border: 1px solid #000; text-align: left; padding: 2px 4px;">Excellent</td><td style="border: 1px solid #000; padding: 2px 4px;">-</td><td style="border: 1px solid #000; padding: 2px 4px;">81 - 90</td></tr>
                      <tr><td class="bold" style="border: 1px solid #000; padding: 2px 4px; font-weight: bold;">B1</td><td class="text-left" style="border: 1px solid #000; text-align: left; padding: 2px 4px;">Very Good</td><td style="border: 1px solid #000; padding: 2px 4px;">-</td><td style="border: 1px solid #000; padding: 2px 4px;">71 - 80</td></tr>
                      <tr><td class="bold" style="border: 1px solid #000; padding: 2px 4px; font-weight: bold;">B2</td><td class="text-left" style="border: 1px solid #000; text-align: left; padding: 2px 4px;">Good</td><td style="border: 1px solid #000; padding: 2px 4px;">-</td><td style="border: 1px solid #000; padding: 2px 4px;">61 - 70</td></tr>
                      <tr><td class="bold" style="border: 1px solid #000; padding: 2px 4px; font-weight: bold;">C1</td><td class="text-left" style="border: 1px solid #000; text-align: left; padding: 2px 4px;">Above Average</td><td style="border: 1px solid #000; padding: 2px 4px;">-</td><td style="border: 1px solid #000; padding: 2px 4px;">51 - 60</td></tr>
                      <tr><td class="bold" style="border: 1px solid #000; padding: 2px 4px; font-weight: bold;">C2</td><td class="text-left" style="border: 1px solid #000; text-align: left; padding: 2px 4px;">Average</td><td style="border: 1px solid #000; padding: 2px 4px;">-</td><td style="border: 1px solid #000; padding: 2px 4px;">41 - 50</td></tr>
                      <tr><td class="bold" style="border: 1px solid #000; padding: 2px 4px; font-weight: bold;">D</td><td class="text-left" style="border: 1px solid #000; text-align: left; padding: 2px 4px;">Marginal</td><td style="border: 1px solid #000; padding: 2px 4px;">-</td><td style="border: 1px solid #000; padding: 2px 4px;">33 - 40</td></tr>
                      <tr><td class="bold" style="border: 1px solid #000; padding: 2px 4px; font-weight: bold;">E</td><td class="text-left" style="border: 1px solid #000; text-align: left; padding: 2px 4px;">Needs Improvement</td><td style="border: 1px solid #000; padding: 2px 4px;">-</td><td style="border: 1px solid #000; padding: 2px 4px;">Below 32</td></tr>
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
        .dps-indirapuram-container { font-family: Arial, sans-serif; font-size: 12px; color: #333; }
        .border-outer { border: 3px double #000; padding: 10px; max-width: 800px; margin: auto; min-height: 270mm; display: flex; flex-direction: column; box-sizing: border-box; }
        .header { text-align: center; margin-bottom: 20px; }
        .header h1 { color: #d35400; font-size: 24px; margin: 0; text-transform: uppercase; }
        .header h2 { font-size: 18px; margin: 5px 0; }
        .header h3 { font-size: 16px; margin: 5px 0; }
        .school-info { font-size: 11px; margin-bottom: 10px; }
        
        .student-info { width: 100%; margin-bottom: 15px; border-collapse: collapse; }
        .student-info td { padding: 4px 0; vertical-align: top; }
        
        table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
        table, th, td { border: 1px solid black; }
        th, td { padding: 6px; text-align: center; }
        .left-align { text-align: left; }
        
        .scholastic-area th { background-color: #f2f2f2; }
        
        .remarks { margin: 15px 0; font-weight: bold; margin-top: 40px; }
        .signatures { display: flex; justify-content: space-between; margin-top: auto; padding-bottom: 20px; text-align: center; }
        .grading-scale { width: 40%; margin: 20px auto; page-break-inside: avoid; }
        .grading-scale th { background-color: #f2f2f2; }
    `
  }
];

export const TC_TEMPLATES: DocumentTemplate[] = [
  {
    id: 'system-default-tc',
    name: 'Standard TC',
    description: 'Standard Transfer Certificate',
    type: 'transfer_certificate',
    content: `
      < div class= "tc-document" >
        <div class="tc-header">
          {{ logoSection }}
<div class="tc-school-details" >
  <h1>{{ schoolName }}</h1>
    < p > {{ schoolAddress }}</p>
      </div>
      </div>
      < h2 class="tc-title" > TRANSFER CERTIFICATE </h2>

        < div class="tc-body" >
          <p>This is to certify that < strong > {{ studentName }}</strong>, son/daughter of Mr./ Mrs. < strong > {{ fatherName }}</strong>, Admission No. <strong>{{admissionNumber}}</strong >, was a bona fide student of this school.</p>

            < p > He / She has passed the < strong > {{ grade }}</strong> examination held in <strong>{{session}}</strong >.</p>

              < p > His / Her date of birth as per school records is < strong > {{ dob }}</strong>.</p >

                <p>General Conduct: <strong>Good < /strong></p >

                  <div class="tc-dates" >
                    <p>Date of Application: { { currentDate } } </p>
                      < p > Date of Issue: { { currentDate } } </p>
                        </div>
                        </div>

                        < div class="tc-footer" >
                          <div class="seal" > School Seal </div>
                            < div class="principal-sig" > Principal Signature </div>
                              </div>
                              </div>
                                `,
    styles: `
                                .tc - document { max - width: 800px; margin: 40px auto; font - family: 'Times New Roman', serif; line - height: 1.6; }
      .tc - header { display: flex; justify - content: center; align - items: center; margin - bottom: 40px; border - bottom: 2px solid #000; padding - bottom: 20px; }
      .tc - school - details { text - align: center; margin - left: 20px; }
      .tc - title { text - align: center; text - decoration: underline; font - size: 24px; margin - bottom: 40px; letter - spacing: 2px; }
      .tc - body p { margin - bottom: 20px; font - size: 18px; text - align: justify; }
      .tc - footer { display: flex; justify - content: space - between; margin - top: 80px; align - items: flex - end; }
      .principal - sig { border - top: 1px solid #000; width: 200px; text - align: center; padding - top: 10px; }
`
  },
  {
    id: 'system-classic-tc',
    name: 'Classic TC (Bordered)',
    description: 'Traditional bordered Transfer Certificate',
    type: 'transfer_certificate',
    content: `
  < div class="tc-classic-container" >
    <div class="tc-border-inner" >
      <div class="tc-header" >
        <div class="school-logo" > {{ logoSection }}</div>
          < div class="school-details" >
            <h1>{{ schoolName }}</h1>
              < p > {{ schoolAddress }}</p>
                < p > Affiliated to CBSE, New Delhi </p>
                  </div>
                  </div>

                  < div class="tc-heading" > TRANSFER CERTIFICATE </div>

                    < div class="tc-body" >
                      <p><strong>TC Number: </strong> TC/2024 / {{ admissionNumber }}</p>
                        < p > <strong>Admission No: </strong> {{admissionNumber}}</p >

                          <div class="tc-content-lines" >
                            <p>This is to certify that < strong > {{ studentName }}</strong></p >
                              <p>Son / Daughter of Mr. < strong > {{ fatherName }}</strong> and Mrs. <strong>{{motherName}}</strong > </p>
                                < p > was a bonafide student of this school from<strong>...</strong> to <strong>...</strong >.</p>
                                  < p > He / She has passed the < strong > {{ grade }}</strong> examination held in <strong>{{session}}</strong >.</p>
                                    < p > Date of Birth as per record: <strong>{{ dob }}</strong></p >
                                      <p>General Conduct: <strong>GOOD < /strong></p >
                                        </div>

                                        < div class="tc-date" >
                                          Date of Issue: { { currentDate } }
</div>
  </div>

  < div class="tc-footer" >
    <div class="sign-box" > Prepared By </div>
      < div class="sign-box" > Checked By </div>
        < div class="sign-box" > Principal </div>
          </div>
          </div>
          </div>
            `,
    styles: `
            .tc - classic - container { padding: 5px; border: 6px double #000; height: 98vh; box - sizing: border - box; background: #fff; position: relative; }
      .tc - border - inner { border: 2px solid #222; height: 100 %; padding: 30px; display: flex; flex - direction: column; justify - content: space - between; position: relative; z - index: 2; }

      /* Watermark-like background effect */
      .tc - classic - container::before {
  content: "TRANSFER CERTIFICATE";
  position: absolute;
  top: 50 %; left: 50 %;
  transform: translate(-50 %, -50 %) rotate(-45deg);
  font - size: 80px;
  color: rgba(0, 0, 0, 0.03);
  font - weight: bold;
  white - space: nowrap;
  pointer - events: none;
  z - index: 1;
}
      
      .tc - header { text - align: center; margin - bottom: 30px; border - bottom: 2px solid #000; padding - bottom: 20px; }
      .school - logo { margin - bottom: 15px; text - align: center; } 
      .school - logo img { height: 80px; width: auto; }
      
      .school - details h1 { font - family: 'Times New Roman', serif; font - size: 36px; text - transform: uppercase; margin: 0 0 5px; letter - spacing: 1px; color: #000; }
      .school - details p { font - family: 'Georgia', serif; font - style: italic; font - size: 14px; margin: 2px 0; color: #444; }
      
      .tc - heading {
  text - align: center; font - size: 28px; font - weight: 900;
  text - decoration: underline; text - underline - offset: 5px;
  margin: 30px 0; font - family: 'Times New Roman', serif;
  text - transform: uppercase; letter - spacing: 2px;
}
      
      .tc - body { font - size: 18px; line - height: 2.2; font - family: 'Georgia', 'Times New Roman', serif; color: #111; padding: 0 20px; }
      
      .tc - content - lines p { margin: 15px 0; border - bottom: 1px dotted #999; padding - bottom: 5px; }
      .tc - content - lines strong { font - family: 'Times New Roman', serif; font - size: 20px; font - weight: bold; margin: 0 5px; color: #000; }
      
      .tc - date { margin - top: 40px; font - style: italic; text - align: left; font - weight: bold; }
      
      .tc - footer { display: flex; justify - content: space - between; margin - top: 60px; padding: 0 20px; }
      .sign - box { width: 200px; border - top: 1px solid #000; padding - top: 10px; text - align: center; font - weight: bold; font - family: 'Times New Roman', serif; font - size: 15px; }
`
  }
];

export const getAllTemplates = () => [...REPORT_TEMPLATES, ...TC_TEMPLATES];
export const getTemplateById = (id: string) => getAllTemplates().find(t => t.id === id);
