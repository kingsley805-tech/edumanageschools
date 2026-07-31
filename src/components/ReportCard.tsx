import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const BRAND = '#0f6b3f';
const BRAND_SOFT = '#e6f4ec';
const INK = '#1a1a1a';
const INK_MUTED = '#6b7280';
const BORDER = '#e2e5e9';
const ROW_ALT = '#f7f9f8';

const GRADE_COLORS: Record<string, string> = {
  'A+': '#0f6b3f',
  A: '#178a52',
  B: '#2563eb',
  C: '#b45309',
  D: '#c2410c',
  F: '#b91c1c',
};

const styles = StyleSheet.create({
  page: {
    padding: 0,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: INK,
  },
  headerBand: {
    backgroundColor: BRAND,
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 40,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 10.5,
    color: '#d6ede1',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  termChip: {
    position: 'absolute',
    top: 28,
    right: 40,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 3,
  },
  termChipText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
  },
  body: {
    paddingHorizontal: 40,
    paddingTop: 24,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: INK,
    marginBottom: 8,
  },
  sectionTitleRule: {
    height: 2,
    width: 28,
    backgroundColor: BRAND,
    marginBottom: 10,
  },
  infoPanel: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: ROW_ALT,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  infoItem: {
    width: '50%',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 8,
    color: INK_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: INK,
  },
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: BRAND,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  tableHeaderText: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tableRowAlt: {
    backgroundColor: ROW_ALT,
  },
  tableFooterRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: BRAND_SOFT,
  },
  col1: { width: '40%', fontSize: 9.5 },
  col2: { width: '20%', fontSize: 9.5, textAlign: 'center' },
  col3: { width: '20%', fontSize: 9.5, textAlign: 'center' },
  col4: { width: '20%', fontSize: 9.5, textAlign: 'center' },
  gradeBadge: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },
  footerBold: {
    fontFamily: 'Helvetica-Bold',
  },
  attendanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: ROW_ALT,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  attendanceStat: {
    flex: 1,
  },
  attendanceValue: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: BRAND,
  },
  attendanceLabel: {
    fontSize: 8,
    color: INK_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 2,
  },
  attendanceBarTrack: {
    height: 6,
    width: '100%',
    backgroundColor: '#dfe4e2',
    borderRadius: 3,
    marginTop: 6,
  },
  attendanceBarFill: {
    height: 6,
    backgroundColor: BRAND,
    borderRadius: 3,
  },
  remarks: {
    marginTop: 4,
    padding: 12,
    backgroundColor: BRAND_SOFT,
    borderLeftWidth: 3,
    borderLeftColor: BRAND,
    borderRadius: 2,
  },
  remarksText: {
    fontSize: 10,
    color: INK,
    lineHeight: 1.5,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    fontSize: 8,
    color: INK_MUTED,
  },
});

interface ReportCardProps {
  student: {
    full_name: string;
    admission_no: string;
    class_name: string;
  };
  term: string;
  grades: Array<{
    subject: string;
    score: number;
    exam_marks?: number;
    total_marks?: number;
    grade?: string;
  }>;
  attendance: {
    present: number;
    total: number;
    percentage: string;
  };
  remarks?: string;
  /** Optional branding overrides — safe defaults keep existing callers unchanged. */
  schoolName?: string;
}

const calculateGrade = (score: number): string => {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
};

const gradeColor = (grade: string): string => GRADE_COLORS[grade] ?? INK;

export const ReportCard = ({ student, term, grades, attendance, remarks, schoolName }: ReportCardProps) => {
  const scored = grades.map((g) => ({
    ...g,
    displayScore: g.exam_marks ?? g.score,
    displayTotal: g.total_marks ?? 100,
    displayGrade: g.grade || calculateGrade(g.score),
  }));
  const average = scored.length
    ? Math.round((scored.reduce((sum, g) => sum + Number(g.score || 0), 0) / scored.length) * 10) / 10
    : 0;
  const attendancePct = Math.max(0, Math.min(100, parseFloat(attendance.percentage) || 0));

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBand}>
          <Text style={styles.title}>{schoolName || 'EduManage School'}</Text>
          <Text style={styles.subtitle}>Student Report Card</Text>
          <View style={styles.termChip}>
            <Text style={styles.termChipText}>{term}</Text>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Student Information</Text>
            <View style={styles.sectionTitleRule} />
            <View style={styles.infoPanel}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Full Name</Text>
                <Text style={styles.infoValue}>{student.full_name}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Admission No.</Text>
                <Text style={styles.infoValue}>{student.admission_no}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Class</Text>
                <Text style={styles.infoValue}>{student.class_name}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Term</Text>
                <Text style={styles.infoValue}>{term}</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Academic Performance</Text>
            <View style={styles.sectionTitleRule} />
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.col1, styles.tableHeaderText]}>Subject</Text>
                <Text style={[styles.col2, styles.tableHeaderText]}>Score</Text>
                <Text style={[styles.col3, styles.tableHeaderText]}>Total</Text>
                <Text style={[styles.col4, styles.tableHeaderText]}>Grade</Text>
              </View>
              {scored.map((grade, index) => (
                <View
                  key={index}
                  style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}
                >
                  <Text style={styles.col1}>{grade.subject}</Text>
                  <Text style={styles.col2}>{grade.displayScore}</Text>
                  <Text style={styles.col3}>{grade.displayTotal}</Text>
                  <Text style={[styles.col4, styles.gradeBadge, { color: gradeColor(grade.displayGrade) }]}>
                    {grade.displayGrade}
                  </Text>
                </View>
              ))}
              <View style={styles.tableFooterRow}>
                <Text style={[styles.col1, styles.footerBold]}>Average</Text>
                <Text style={[styles.col2, styles.footerBold]}>{average}</Text>
                <Text style={styles.col3}> </Text>
                <Text style={[styles.col4, styles.footerBold, { color: gradeColor(calculateGrade(average)) }]}>
                  {calculateGrade(average)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Attendance Record</Text>
            <View style={styles.sectionTitleRule} />
            <View style={styles.attendanceRow}>
              <View style={styles.attendanceStat}>
                <Text style={styles.attendanceValue}>
                  {attendance.present}/{attendance.total}
                </Text>
                <Text style={styles.attendanceLabel}>Days Present</Text>
              </View>
              <View style={{ flex: 2 }}>
                <Text style={styles.attendanceValue}>{attendance.percentage}</Text>
                <Text style={styles.attendanceLabel}>Attendance Rate</Text>
                <View style={styles.attendanceBarTrack}>
                  <View style={[styles.attendanceBarFill, { width: `${attendancePct}%` }]} />
                </View>
              </View>
            </View>
          </View>

          {remarks && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Teacher&apos;s Remarks</Text>
              <View style={styles.sectionTitleRule} />
              <View style={styles.remarks}>
                <Text style={styles.remarksText}>{remarks}</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.footer} fixed>
          <Text>Generated {new Date().toLocaleDateString()}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};
