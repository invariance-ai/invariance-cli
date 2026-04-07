import {
  UserSchema,
  TraceSchema,
  TraceListSchema,
  MonitorListSchema,
  MonitorRunResultSchema,
  SignalListSchema,
  QueryResultSchema,
  DatasetSchema,
  EvaluationSchema,
  SessionSchema,
  type User,
  type Trace,
  type TraceList,
  type MonitorList,
  type MonitorRunResult,
  type SignalList,
  type QueryResult,
  type Dataset,
  type Evaluation,
  type Session,
} from "../types/index.js";
import { ApiError, AuthenticationError, NetworkError, NotFoundError } from "./errors.js";

export interface ClientOptions {
  apiKey: string;
  baseUrl: string;
}

export class InvarianceClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options: ClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
  }

  private async request<T>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      params?: Record<string, string | undefined>;
    },
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (options?.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined) {
          url.searchParams.set(key, value);
        }
      }
    }

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "invariance-cli",
        },
        body: options?.body ? JSON.stringify(options.body) : undefined,
      });
    } catch (error) {
      if (error instanceof TypeError) {
        throw new NetworkError();
      }
      throw error;
    }

    if (!response.ok) {
      if (response.status === 401) {
        throw new AuthenticationError();
      }
      if (response.status === 404) {
        throw new NotFoundError("Resource", path);
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        body = await response.text().catch(() => undefined);
      }

      const message =
        body && typeof body === "object" && "message" in body
          ? String((body as { message: unknown }).message)
          : `API request failed with status ${response.status}`;

      throw new ApiError(message, response.status, body);
    }

    return (await response.json()) as T;
  }

  async whoami(): Promise<User> {
    const data = await this.request<unknown>("GET", "/v1/auth/whoami");
    return UserSchema.parse(data);
  }

  async listTraces(options?: { limit?: number; status?: string }): Promise<TraceList> {
    const params: Record<string, string | undefined> = {};
    if (options?.limit !== undefined) params["limit"] = String(options.limit);
    if (options?.status) params["status"] = options.status;

    const data = await this.request<unknown>("GET", "/v1/traces", { params });
    return TraceListSchema.parse(data);
  }

  async getTrace(id: string): Promise<Trace> {
    const data = await this.request<unknown>("GET", `/v1/traces/${encodeURIComponent(id)}`);
    return TraceSchema.parse(data);
  }

  async query(prompt: string): Promise<QueryResult> {
    const data = await this.request<unknown>("POST", "/v1/query", {
      body: { prompt },
    });
    return QueryResultSchema.parse(data);
  }

  async listMonitors(): Promise<MonitorList> {
    const data = await this.request<unknown>("GET", "/v1/monitors");
    return MonitorListSchema.parse(data);
  }

  async runMonitor(id: string): Promise<MonitorRunResult> {
    const data = await this.request<unknown>(
      "POST",
      `/v1/monitors/${encodeURIComponent(id)}/run`,
    );
    return MonitorRunResultSchema.parse(data);
  }

  async listSignals(): Promise<SignalList> {
    const data = await this.request<unknown>("GET", "/v1/signals");
    return SignalListSchema.parse(data);
  }

  async listDatasets(options?: { agentId?: string }): Promise<Dataset[]> {
    const params: Record<string, string | undefined> = {};
    if (options?.agentId) params["agent_id"] = options.agentId;

    const data = await this.request<unknown>("GET", "/v1/datasets", { params });
    return DatasetSchema.array().parse(data);
  }

  async getDataset(id: string): Promise<Dataset> {
    const data = await this.request<unknown>("GET", `/v1/datasets/${encodeURIComponent(id)}`);
    return DatasetSchema.parse(data);
  }

  async listEvals(options?: {
    suiteId?: string;
    agentId?: string;
    status?: string;
    datasetId?: string;
  }): Promise<Evaluation[]> {
    const params: Record<string, string | undefined> = {};
    if (options?.suiteId) params["suite_id"] = options.suiteId;
    if (options?.agentId) params["agent_id"] = options.agentId;
    if (options?.status) params["status"] = options.status;
    if (options?.datasetId) params["dataset_id"] = options.datasetId;

    const data = await this.request<unknown>("GET", "/v1/evals/runs", { params });
    return EvaluationSchema.array().parse(data);
  }

  async getEval(id: string): Promise<Evaluation> {
    const data = await this.request<unknown>("GET", `/v1/evals/runs/${encodeURIComponent(id)}`);
    return EvaluationSchema.parse(data);
  }

  async runEval(
    suiteId: string,
    options: {
      agentId: string;
      versionLabel?: string;
      sessionIds?: string[];
    },
  ): Promise<Evaluation> {
    const data = await this.request<unknown>("POST", `/v1/evals/suites/${encodeURIComponent(suiteId)}/run`, {
      body: {
        agent_id: options.agentId,
        version_label: options.versionLabel,
        session_ids: options.sessionIds,
      },
    });
    return EvaluationSchema.parse(data);
  }

  async listSessions(options?: {
    limit?: number;
    status?: string;
    offset?: number;
    agentId?: string;
  }): Promise<Session[]> {
    const params: Record<string, string | undefined> = {};
    if (options?.limit !== undefined) params["limit"] = String(options.limit);
    if (options?.offset !== undefined) params["offset"] = String(options.offset);
    if (options?.status) params["status"] = options.status;
    if (options?.agentId) params["agent_id"] = options.agentId;

    const data = await this.request<unknown>("GET", "/v1/sessions", { params });
    return SessionSchema.array().parse(data);
  }

  async getSession(id: string): Promise<Session> {
    const data = await this.request<unknown>("GET", `/v1/sessions/${encodeURIComponent(id)}`);
    return SessionSchema.parse(data);
  }
}

export function buildUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}
