import { Test, TestingModule } from '@nestjs/testing';
import { HoraireDesCoursService } from './horaire_des_cours.service';

describe('HoraireDesCoursService', () => {
  let service: HoraireDesCoursService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HoraireDesCoursService],
    }).compile();

    service = module.get<HoraireDesCoursService>(HoraireDesCoursService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
