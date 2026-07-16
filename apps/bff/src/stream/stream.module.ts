import { Module } from '@nestjs/common';

import { BrokerModule } from '../broker/broker.module';
import { StreamService } from './stream.service';

@Module({
  imports: [BrokerModule],
  providers: [StreamService],
  exports: [StreamService],
})
export class StreamModule {}
