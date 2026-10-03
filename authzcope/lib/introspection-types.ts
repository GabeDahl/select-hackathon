export type IntrospectionInput = {
  connectionString?: string;
  aiModel: string;
  aiApiKey?: string;
};

export type ConfigurationStatus = {
  databaseConfigured: boolean;
  aiApiKeyConfigured: boolean;
};

export type IntrospectionResult =
  | {
      ok: true;
      stage: "connection";
      databaseSource: "environment" | "input";
      aiModel: string;
      aiApiKeyConfigured: true;
    }
  | {
      ok: false;
      message: string;
      fieldErrors?: Partial<Record<keyof IntrospectionInput, string>>;
    };
