import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { JwtPayload } from "../auth/interfaces/jwt-payload.interface";
import type { JourneyCapability } from "./journey.constants";
import { JourneyAccessService } from "./journey-access.service";

export const JOURNEY_CAPABILITY_KEY = "journey_capability";

export const RequireJourneyCapability = (capability: JourneyCapability) =>
  SetMetadata(JOURNEY_CAPABILITY_KEY, capability);

@Injectable()
export class JourneyCapabilityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: JourneyAccessService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const capability = this.reflector.getAllAndOverride<JourneyCapability>(
      JOURNEY_CAPABILITY_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!capability) return true;
    const user = context
      .switchToHttp()
      .getRequest<{ user?: JwtPayload }>().user;
    return Boolean(user && this.access.can(user, capability));
  }
}
