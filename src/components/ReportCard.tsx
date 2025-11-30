import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    textAlign: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingBottom: 5,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  label: {
    width: '40%',
    fontWeight: 'bold',
  },
  value: {
    width: '60%',
  },
  table: {
    width: '100%',
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: '#000',
    paddingBottom: 5,
    marginBottom: 5,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingVertical: 5,
  },
  col1: { width: '40%' },
  col2: { width: '20%' },
  col3: { width: '20%' },
  col4: { width: '20%' },
  remarks: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 5,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#666',
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
}

export const ReportCard = ({ student, term, grades, attendance, remarks }: ReportCardProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>EduManage School</Text>
        <Text style={styles.subtitle}>Student Report Card</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Student Information</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Name:</Text>
          <Text style={styles.value}>{student.full_name}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Admission No:</Text>
          <Text style={styles.value}>{student.admission_no}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Class:</Text>
          <Text style={styles.value}>{student.class_name}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Term:</Text>
          <Text style={styles.value}>{term}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Academic Performance</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.col1}>Subject</Text>
            <Text style={styles.col2}>Score</Text>
            <Text style={styles.col3}>Total</Text>
            <Text style={styles.col4}>Grade</Text>
          </View>
          {grades.map((grade, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={styles.col1}>{grade.subject}</Text>
              <Text style={styles.col2}>{grade.exam_marks || grade.score}</Text>
              <Text style={styles.col3}>{grade.total_marks || 100}</Text>
              <Text style={styles.col4}>{grade.grade || calculateGrade(grade.score)}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Attendance Record</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Days Present:</Text>
          <Text style={styles.value}>{attendance.present} / {attendance.total}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Attendance Rate:</Text>
          <Text style={styles.value}>{attendance.percentage}</Text>
        </View>
      </View>

      {remarks && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Teacher's Remarks</Text>
          <View style={styles.remarks}>
            <Text>{remarks}</Text>
          </View>
        </View>
      )}

      <Text style={styles.footer}>
        Generated on {new Date().toLocaleDateString()} • EduManage School Management System
      </Text>
    </Page>
  </Document>
);

const calculateGrade = (score: number): string => {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
};
