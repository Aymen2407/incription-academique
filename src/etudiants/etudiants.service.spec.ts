import { Test, TestingModule } from '@nestjs/testing';
import { EtudiantsService } from './etudiants.service';

describe('EtudiantsService', () => {
  let service: EtudiantsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EtudiantsService],
    }).compile();

    service = module.get<EtudiantsService>(EtudiantsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
