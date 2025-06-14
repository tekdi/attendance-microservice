import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer } from 'kafkajs';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly kafka: Kafka;
  private producer: Producer;
  private readonly logger = new Logger(KafkaService.name);
  private isKafkaEnabled: boolean; // Flag to check if Kafka is enabled

  constructor(private configService: ConfigService) {
    // Retrieve Kafka config from the configuration
    this.isKafkaEnabled = this.configService.get<boolean>('kafkaEnabled', false); // Default to true if not specified
    const brokers = this.configService.get<string>('KAFKA_BROKERS', 'localhost:9092').split(',');
    const clientId = this.configService.get<string>('KAFKA_CLIENT_ID', 'attendance-service');

    // Initialize Kafka client if enabled
    if (this.isKafkaEnabled) {
      this.kafka = new Kafka({
        clientId,
        brokers,
        retry: {
          initialRetryTime: 100,
          retries: 8, // You can configure retries here
        },
      });

      this.producer = this.kafka.producer();
    }
  }

  async onModuleInit() {
    if (this.isKafkaEnabled) {
      try {
        await this.connectProducer();
        this.logger.log('Kafka producer initialized successfully');
      } catch (error) {
        this.logger.error('Failed to initialize Kafka producer', error);
      }
    } else {
      this.logger.log('Kafka is disabled. Skipping producer initialization.');
    }
  }

  async onModuleDestroy() {
    if (this.isKafkaEnabled) {
      await this.disconnectProducer();
    }
  }

  private async connectProducer() {
    try {
      await this.producer.connect();
      this.logger.log('Kafka producer connected');
    } catch (error) {
      this.logger.error(`Failed to connect Kafka producer: ${error.message}`, error.stack);
      throw error; // Throwing error to indicate connection failure
    }
  }

  private async disconnectProducer() {
    try {
      await this.producer.disconnect();
      this.logger.log('Kafka producer disconnected');
    } catch (error) {
      this.logger.error(`Failed to disconnect Kafka producer: ${error.message}`, error.stack);
    }
  }

  /**
   * Publish a message to a Kafka topic
   * 
   * @param topic - The Kafka topic to publish to
   * @param message - The message payload to publish
   * @param key - Optional message key for partitioning
   * @returns A promise that resolves when the message is sent
   */
  async publishMessage(topic: string, message: any, key?: string): Promise<void> {
    if (!this.isKafkaEnabled) {
      this.logger.warn('Kafka is disabled. Skipping message publish.');
      return; // Do nothing if Kafka is disabled
    }

    try {
      const payload = {
        topic,
        messages: [
          {
            key: key || undefined,
            value: typeof message === 'string' ? message : JSON.stringify(message),
          },
        ],
      };

      await this.producer.send(payload);
      this.logger.debug(`Message published to topic: ${topic}`);
    } catch (error) {
      this.logger.error(`Failed to publish message to topic ${topic}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Publish a attendance-related event to Kafka
   * 
   * @param eventType - The type of attendance event (created, updated, deleted)
   * @param attendanceData - The attendance data to include in the event
   * @param attendanceId - The ID of the attendance (used as the message key)
   */
  async publishAttendanceEvent(eventType: 'created' | 'updated' | 'deleted', attendanceData: any, attendanceId: string): Promise<void> {
    if (!this.isKafkaEnabled) {
      this.logger.warn('Kafka is disabled. Skipping attendance event publish.');
      return; // Do nothing if Kafka is disabled
    }
  
    const topic = this.configService.get<string>('KAFKA_TOPIC', 'attendance-topic');
    let fullEventType = '';
    switch (eventType) {
      case 'created':
        fullEventType = 'ATTENDANCE_CREATED';
        break;
      case 'updated':
        fullEventType = 'ATTENDANCE_UPDATED';
        break;
      case 'deleted':
        fullEventType = 'ATTENDANCE_DELETED';
        break;
      default:
        fullEventType = 'UNKNOWN_EVENT';
        break;
    }
  
    const payload = {
      eventType: fullEventType,
      timestamp: new Date().toISOString(),
      attendanceId,
      data: attendanceData
    };
      
    await this.publishMessage(topic, payload, attendanceId);
    this.logger.log(`Attendance ${fullEventType} event published for attendance ${attendanceId}`);
  }
}
