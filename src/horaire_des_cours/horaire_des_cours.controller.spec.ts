import { Test, TestingModule } from '@nestjs/testing';
import { HoraireDesCoursController } from './horaire_des_cours.controller';

describe('HoraireDesCoursController', () => {
  let controller: HoraireDesCoursController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HoraireDesCoursController],
    }).compile();

    controller = module.get<HoraireDesCoursController>(HoraireDesCoursController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
