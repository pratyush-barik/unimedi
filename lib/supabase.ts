import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Default initial data for resilient demo execution
const INITIAL_DOCTORS = [
  {
    id: "00000000-0000-4000-a000-000000000001",
    email: "sangeetakumarinew0606@gmail.com",
    full_name: "Dr. Sangeeta Kumari",
    phone: "+91 9876543210",
    blood_group: "O+",
    gender: "Female",
    date_of_birth: "1988-06-06",
    address: "Campus Health Centre, Senior Physician Suite",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "11111111-1111-4111-a111-111111111111",
    email: "dr.sharma@unimedi.org",
    full_name: "Rajesh Sharma",
    phone: "+91 9811122233",
    blood_group: "O+",
    gender: "Male",
    date_of_birth: "1978-04-12",
    address: "Campus Health Centre, Cardiology Suite 101",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "22222222-2222-4222-a222-222222222222",
    email: "dr.ananya@unimedi.org",
    full_name: "Ananya Deshmukh",
    phone: "+91 9822233344",
    blood_group: "A+",
    gender: "Female",
    date_of_birth: "1985-09-20",
    address: "Campus Health Centre, OPD Clinic 2",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "33333333-3333-4333-a333-333333333333",
    email: "dr.kapoor@unimedi.org",
    full_name: "Vikram Kapoor",
    phone: "+91 9833344455",
    blood_group: "B+",
    gender: "Male",
    date_of_birth: "1980-11-05",
    address: "Sports Medicine Complex, Ortho Wing",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const INITIAL_PATIENTS = [
  {
    id: "44444444-4444-4444-a444-444444444444",
    email: "arun.patel@student.edu",
    full_name: "Arun Patel",
    phone: "+91 9876543210",
    blood_group: "O+",
    gender: "Male",
    date_of_birth: "2002-05-14",
    address: "Hostel Block 4, Room 210, Campus North",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "55555555-5555-4555-a555-555555555555",
    email: "priya.verma@student.edu",
    full_name: "Priya Verma",
    phone: "+91 9876543211",
    blood_group: "B+",
    gender: "Female",
    date_of_birth: "2003-08-22",
    address: "Hostel Block 2, Room 105, Campus South",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "66666666-6666-4666-a666-666666666666",
    email: "rohit.singh@student.edu",
    full_name: "Rohit Singh",
    phone: "+91 9876543212",
    blood_group: "AB+",
    gender: "Male",
    date_of_birth: "2001-11-03",
    address: "Day Scholar, Sector 15 Avenue",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const INITIAL_ROLES = [
  {
    id: "r0-0000-0000",
    user_id: "00000000-0000-4000-a000-000000000001",
    role: "doctor",
    speciality: "General Physician & Consultant",
    license_number: "MCI-77391-S",
    hospital_affiliation: "University Central Medical Centre",
    created_at: new Date().toISOString(),
  },
  {
    id: "r1-1111-1111",
    user_id: "11111111-1111-4111-a111-111111111111",
    role: "doctor",
    speciality: "Cardiology",
    license_number: "MCI-48291-C",
    hospital_affiliation: "University Central Medical Centre",
    created_at: new Date().toISOString(),
  },
  {
    id: "r2-2222-2222",
    user_id: "22222222-2222-4222-a222-222222222222",
    role: "doctor",
    speciality: "General Physician",
    license_number: "MCI-59102-G",
    hospital_affiliation: "Campus Health Centre",
    created_at: new Date().toISOString(),
  },
  {
    id: "r3-3333-3333",
    user_id: "33333333-3333-4333-a333-333333333333",
    role: "doctor",
    speciality: "Orthopedics & Sports Medicine",
    license_number: "MCI-62041-O",
    hospital_affiliation: "Sports Medicine & Rehabilitation Wing",
    created_at: new Date().toISOString(),
  },
  {
    id: "r4-4444-4444",
    user_id: "44444444-4444-4444-a444-444444444444",
    role: "patient",
    speciality: null,
    license_number: null,
    hospital_affiliation: null,
    created_at: new Date().toISOString(),
  },
  {
    id: "r5-5555-5555",
    user_id: "55555555-5555-4555-a555-555555555555",
    role: "patient",
    speciality: null,
    license_number: null,
    hospital_affiliation: null,
    created_at: new Date().toISOString(),
  },
  {
    id: "r6-6666-6666",
    user_id: "66666666-6666-4666-a666-666666666666",
    role: "patient",
    speciality: null,
    license_number: null,
    hospital_affiliation: null,
    created_at: new Date().toISOString(),
  },
];

type StoreData = {
  users: any[];
  user_roles: any[];
  doctor_sessions: any[];
  appointments: any[];
  medical_records: any[];
  reports: any[];
  user_queries: any[];
};

const globalForDB = globalThis as unknown as {
  unimediStore?: StoreData;
};

if (!globalForDB.unimediStore) {
  globalForDB.unimediStore = {
    users: [...INITIAL_DOCTORS, ...INITIAL_PATIENTS],
    user_roles: [...INITIAL_ROLES],
    doctor_sessions: [],
    appointments: [
      {
        id: "apt-1",
        patient_id: "44444444-4444-4444-a444-444444444444",
        doctor_id: "11111111-1111-4111-a111-111111111111",
        appointment_date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
        time_slot: "10:00 AM - 10:30 AM",
        type: "online_booking",
        status: "confirmed",
        reason_for_visit: "Chest tightness and palpitations during physical training",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    medical_records: [
      {
        id: "med-1",
        patient_id: "66666666-6666-4666-a666-666666666666",
        doctor_id: "33333333-3333-4333-a333-333333333333",
        diagnosis: "Right Ankle Inversion Injury (Grade 1 Lateral Ligament Strain)",
        medicines: [
          {
            name: "Aceclofenac + Paracetamol",
            dosage: "100mg / 325mg",
            frequency: "1-0-1",
            duration: "3 days",
            timing: "After Food",
            instructions: "Take with meals.",
          },
        ],
        vitals: {
          bp: "118/78 mmHg",
          pulse: "74",
          temperature: "98.4 F",
          spo2: "99%",
          weight: "68 kg",
        },
        lab_tests: [],
        notes: "Apply RICE protocol.",
        created_at: new Date().toISOString(),
      },
    ],
    reports: [],
    user_queries: [],
  };
}

function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export type QueryResult = {
  data: any;
  error: any;
  count?: number | null;
};

class LocalQueryBuilder {
  private tableName: keyof StoreData;
  private filters: Array<(row: any) => boolean> = [];
  private orderConfig: { column: string; ascending: boolean } | null = null;
  private limitCount: number | null = null;
  private pendingInsert: any[] | null = null;
  private pendingUpdate: any | null = null;
  private isDelete: boolean = false;

  constructor(tableName: keyof StoreData) {
    this.tableName = tableName;
    const store = globalForDB.unimediStore!;
    if (!store[tableName]) {
      store[tableName] = [];
    }
  }

  select(_columns: string = "*", _options?: { count?: string; head?: boolean }) {
    return this;
  }

  insert(rows: any | any[]) {
    this.pendingInsert = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  update(updates: any) {
    this.pendingUpdate = updates;
    return this;
  }

  delete() {
    this.isDelete = true;
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push((row) => row[column] !== value);
    return this;
  }

  in(column: string, values: any[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  order(column: string, { ascending = true }: { ascending?: boolean } = {}) {
    this.orderConfig = { column, ascending };
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  private execute(): QueryResult {
    const store = globalForDB.unimediStore!;
    const table = store[this.tableName] || [];

    // INSERT
    if (this.pendingInsert) {
      const insertedRows = this.pendingInsert.map((item) => {
        const row = {
          id: item.id || generateUUID(),
          ...item,
          created_at: item.created_at || new Date().toISOString(),
          updated_at: item.updated_at || new Date().toISOString(),
        };
        table.push(row);
        return row;
      });
      return { data: insertedRows, error: null, count: insertedRows.length };
    }

    // UPDATE
    if (this.pendingUpdate) {
      let matchedRows: any[] = [];
      for (const row of table) {
        const match = this.filters.every((f) => f(row));
        if (match) {
          Object.assign(row, this.pendingUpdate, { updated_at: new Date().toISOString() });
          matchedRows.push(row);
        }
      }
      return { data: matchedRows, error: null, count: matchedRows.length };
    }

    // DELETE
    if (this.isDelete) {
      const remainingRows = table.filter((row) => !this.filters.every((f) => f(row)));
      store[this.tableName] = remainingRows;
      return { data: null, error: null, count: 0 };
    }

    // SELECT
    let result = table.filter((row) => this.filters.every((f) => f(row)));

    if (this.orderConfig) {
      const { column, ascending } = this.orderConfig;
      result.sort((a, b) => {
        const valA = a[column];
        const valB = b[column];
        if (valA < valB) return ascending ? -1 : 1;
        if (valA > valB) return ascending ? 1 : -1;
        return 0;
      });
    }

    if (this.limitCount !== null) {
      result = result.slice(0, this.limitCount);
    }

    return { data: result, error: null, count: result.length };
  }

  async single(): Promise<QueryResult> {
    const { data } = this.execute();
    if (Array.isArray(data) && data.length > 0) {
      return { data: data[0], error: null, count: 1 };
    }
    return { data: null, error: { message: "Row not found", code: "PGRST116" }, count: 0 };
  }

  async maybeSingle(): Promise<QueryResult> {
    const { data } = this.execute();
    if (Array.isArray(data) && data.length > 0) {
      return { data: data[0], error: null, count: 1 };
    }
    return { data: null, error: null, count: 0 };
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    const res = this.execute();
    return Promise.resolve(res).then(onfulfilled, onrejected);
  }
}

// Resilient Supabase client instance
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let rawSupabase: SupabaseClient | null = null;
if (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes("undefined") && supabaseUrl.startsWith("http")) {
  try {
    rawSupabase = createClient(supabaseUrl, supabaseAnonKey);
  } catch (e) {
    console.warn("Failed to initialize raw Supabase client, using resilient fallback:", e);
  }
}

export const supabase = {
  from(tableName: string) {
    return new LocalQueryBuilder(tableName as keyof StoreData);
  },
};
