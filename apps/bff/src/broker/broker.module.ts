import { Global, Module } from '@nestjs/common';

import { BrokerService } from './broker.service';
import { ClusterController } from './cluster.controller';
import { GroupsController } from './groups.controller';
import { ObservabilityController } from './observability.controller';
import { TopicsController } from './topics.controller';

/**
 * Módulo del proxy REST del broker (F1.3). Registra los controllers finos que
 * reexponen el plano de operación (topics, groups, cluster, observabilidad) y
 * el `BrokerService` que hace de cliente HTTP *passthrough*.
 *
 * `@Global()` porque `BrokerService` es un servicio de núcleo que consumen
 * varios módulos (auth lo sondea, stream lo usará): así se inyecta sin crear
 * ciclos de imports entre módulos.
 */
@Global()
@Module({
  controllers: [TopicsController, GroupsController, ClusterController, ObservabilityController],
  providers: [BrokerService],
  exports: [BrokerService],
})
export class BrokerModule {}
