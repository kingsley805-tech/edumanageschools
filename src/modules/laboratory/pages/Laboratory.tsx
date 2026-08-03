import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GenericCrudPage, type FieldDef } from "@/modules/lib/GenericCrudPage";

const facilityFields: FieldDef[] = [
  { key: "name", label: "Lab name", required: true },
  {
    key: "lab_type",
    label: "Type",
    type: "select",
    options: [
      { value: "science", label: "Science" },
      { value: "computer", label: "Computer" },
      { value: "language", label: "Language" },
      { value: "other", label: "Other" },
    ],
  },
  { key: "location", label: "Location" },
  { key: "capacity", label: "Capacity", type: "number" },
  { key: "safety_notes", label: "Safety notes", type: "textarea", list: false },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "active", label: "Active" },
      { value: "maintenance", label: "Maintenance" },
      { value: "inactive", label: "Inactive" },
    ],
  },
];

const equipmentFields: FieldDef[] = [
  { key: "name", label: "Equipment", required: true },
  { key: "asset_tag", label: "Asset tag" },
  { key: "facility_id", label: "Facility ID", list: false, placeholder: "Lab facility UUID" },
  { key: "quantity", label: "Qty", type: "number" },
  {
    key: "condition",
    label: "Condition",
    type: "select",
    options: [
      { value: "good", label: "Good" },
      { value: "fair", label: "Fair" },
      { value: "poor", label: "Poor" },
      { value: "damaged", label: "Damaged" },
      { value: "retired", label: "Retired" },
    ],
  },
  { key: "is_consumable", label: "Consumable", type: "checkbox", list: false },
  { key: "notes", label: "Notes", type: "textarea", list: false },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "available", label: "Available" },
      { value: "checked_out", label: "Checked out" },
      { value: "maintenance", label: "Maintenance" },
    ],
  },
];

const bookingFields: FieldDef[] = [
  { key: "facility_id", label: "Facility ID", required: true, list: false },
  { key: "title", label: "Title", required: true },
  { key: "booked_by_name", label: "Booked by" },
  { key: "class_name", label: "Class" },
  { key: "start_at", label: "Start", type: "datetime", required: true },
  { key: "end_at", label: "End", type: "datetime", required: true },
  { key: "purpose", label: "Purpose", type: "textarea", list: false },
  { key: "attendance_count", label: "Attendance", type: "number", list: false },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "scheduled", label: "Scheduled" },
      { value: "completed", label: "Completed" },
      { value: "cancelled", label: "Cancelled" },
    ],
  },
];

function Facilities() {
  return (
    <GenericCrudPage
      moduleKey="laboratory"
      title="Lab facilities"
      description="Science, computer, and language labs."
      table="lab_facilities"
      accentLabel="Resources"
      fields={facilityFields}
      orderBy="name"
    />
  );
}

function Equipment() {
  return (
    <GenericCrudPage
      moduleKey="laboratory"
      title="Lab equipment"
      description="Equipment inventory, condition, and checkout status."
      table="lab_equipment"
      accentLabel="Resources"
      fields={equipmentFields}
      orderBy="name"
    />
  );
}

function Bookings() {
  return (
    <GenericCrudPage
      moduleKey="laboratory"
      title="Lab bookings"
      description="Schedules, attendance, and lab usage."
      table="lab_bookings"
      accentLabel="Resources"
      fields={bookingFields}
      orderBy="start_at"
      beforeSave={(form) => {
        for (const key of ["start_at", "end_at"]) {
          const v = form[key];
          if (typeof v === "string" && v.length === 16) form[key] = new Date(v).toISOString();
        }
        return form;
      }}
    />
  );
}

export default function LaboratoryPage() {
  return (
    <div className="space-y-4 p-4 md:p-6">
      <Tabs defaultValue="facilities">
        <TabsList>
          <TabsTrigger value="facilities">Facilities</TabsTrigger>
          <TabsTrigger value="equipment">Equipment</TabsTrigger>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
        </TabsList>
        <TabsContent value="facilities" className="mt-0">
          <div className="-m-4 md:-m-6">
            <Facilities />
          </div>
        </TabsContent>
        <TabsContent value="equipment" className="mt-0">
          <div className="-m-4 md:-m-6">
            <Equipment />
          </div>
        </TabsContent>
        <TabsContent value="bookings" className="mt-0">
          <div className="-m-4 md:-m-6">
            <Bookings />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
