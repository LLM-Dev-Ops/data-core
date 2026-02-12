/**
 * Terminal error for simulation persistence failures.
 *
 * When Data-Core fails, the simulation is INVALID.
 * This error is frozen — it cannot be mutated after construction.
 */

export class InvalidSimulationError extends Error {
  public readonly simulationId: string;
  public readonly operationId: string;
  public readonly subsystemFailures: ReadonlyArray<{ subsystem: string; error: string }>;
  public readonly isTerminal = true as const;

  constructor(params: {
    simulationId: string;
    operationId: string;
    message: string;
    subsystemFailures: Array<{ subsystem: string; error: string }>;
  }) {
    super(`[INVALID SIMULATION] ${params.message}`);
    this.name = 'InvalidSimulationError';
    this.simulationId = params.simulationId;
    this.operationId = params.operationId;
    this.subsystemFailures = params.subsystemFailures;
    Object.freeze(this);
  }
}

/** Type guard: checks if an error is an InvalidSimulationError */
export function isInvalidSimulationError(err: unknown): err is InvalidSimulationError {
  return err instanceof InvalidSimulationError && (err as InvalidSimulationError).isTerminal === true;
}
