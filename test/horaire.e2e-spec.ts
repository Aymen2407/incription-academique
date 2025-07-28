import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('HoraireDesCoursController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/horaire-des-cours (GET)', () => {
    it('should return all horaires when no id parameter provided', () => {
      return request(app.getHttpServer())
        .get('/horaire-des-cours')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should return specific horaire when valid id provided', () => {
      return request(app.getHttpServer())
        .get('/horaire-des-cours?id=1')
        .expect(200)
        .expect((res) => {
          if (Object.keys(res.body).length > 0) {
            expect(res.body).toHaveProperty('id');
            expect(res.body).toHaveProperty('sigle');
            expect(res.body).toHaveProperty('horaire');
            expect(res.body).toHaveProperty('lieu');
            expect(res.body).toHaveProperty('enseignants');
            expect(res.body).toHaveProperty('mode_enseignement');
          }
        });
    });

    it('should return empty object when invalid id provided', () => {
      return request(app.getHttpServer())
        .get('/horaire-des-cours?id=99999')
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({});
        });
    });

    it('should return empty object when non-numeric id provided', () => {
      return request(app.getHttpServer())
        .get('/horaire-des-cours?id=abc')
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({});
        });
    });

    it('should handle negative id values', () => {
      return request(app.getHttpServer())
        .get('/horaire-des-cours?id=-1')
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({});
        });
    });

    it('should handle zero id value', () => {
      return request(app.getHttpServer())
        .get('/horaire-des-cours?id=0')
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({});
        });
    });

    it('should handle very large id numbers', () => {
      const largeId = Number.MAX_SAFE_INTEGER;
      return request(app.getHttpServer())
        .get(`/horaire-des-cours?id=${largeId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({});
        });
    });

    it('should handle decimal id values', () => {
      return request(app.getHttpServer())
        .get('/horaire-des-cours?id=1.5')
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({});
        });
    });

    it('should handle empty id parameter', () => {
      return request(app.getHttpServer())
        .get('/horaire-des-cours?id=')
        .expect(200)
        .expect((res) => {
          // Should return all horaires when id is empty
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should handle special characters in id', () => {
      return request(app.getHttpServer())
        .get('/horaire-des-cours?id=1@#$')
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({});
        });
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed requests gracefully', () => {
      return request(app.getHttpServer())
        .get('/horaire-des-cours?id[]=test')
        .expect(500);
    });

    it('should handle multiple id parameters', () => {
      return request(app.getHttpServer())
        .get('/horaire-des-cours?id=1&id=2')
        .expect(500);
    });

    it('should handle very long id parameter values', () => {
      const longValue = 'A'.repeat(1000);
      return request(app.getHttpServer())
        .get(`/horaire-des-cours?id=${longValue}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({});
        });
    });
  });

  describe('Response Structure Validation', () => {
    it('should return horaire with all required fields when found', async () => {
      const response = await request(app.getHttpServer())
        .get('/horaire-des-cours?id=1')
        .expect(200);

      if (Object.keys(response.body).length > 0) {
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('sigle');
        expect(response.body).toHaveProperty('horaire');
        expect(response.body).toHaveProperty('lieu');
        expect(response.body).toHaveProperty('enseignants');
        expect(response.body).toHaveProperty('mode_enseignement');
        expect(response.body).toHaveProperty('trimestre');

        // Validate data types
        expect(typeof response.body.id).toBe('number');
        expect(typeof response.body.sigle).toBe('string');
        expect(typeof response.body.horaire).toBe('string'); // JSON string
        expect(typeof response.body.lieu).toBe('string');
        expect(typeof response.body.enseignants).toBe('string');
        expect(typeof response.body.mode_enseignement).toBe('string');
      }
    });

    it('should return horaires array with proper structure when getting all', async () => {
      const response = await request(app.getHttpServer())
        .get('/horaire-des-cours')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);

      if (response.body.length > 0) {
        const firstHoraire = response.body[0];
        expect(firstHoraire).toHaveProperty('id');
        expect(firstHoraire).toHaveProperty('sigle');
        expect(firstHoraire).toHaveProperty('horaire');
        expect(firstHoraire).toHaveProperty('lieu');
        expect(firstHoraire).toHaveProperty('enseignants');
        expect(firstHoraire).toHaveProperty('mode_enseignement');
      }
    });
  });

  describe('Performance Tests', () => {
    it('should respond within reasonable time for single horaire', async () => {
      const startTime = Date.now();

      await request(app.getHttpServer())
        .get('/horaire-des-cours?id=1')
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(5000);
    });

    it('should respond within reasonable time for all horaires', async () => {
      const startTime = Date.now();

      await request(app.getHttpServer())
        .get('/horaire-des-cours')
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(10000);
    });

    it('should handle multiple concurrent requests', async () => {
      const requests = [
        '/horaire-des-cours?id=1',
        '/horaire-des-cours?id=2',
        '/horaire-des-cours?id=3',
        '/horaire-des-cours',
        '/horaire-des-cours?id=999'
      ];

      const promises = requests.map(url =>
        request(app.getHttpServer())
          .get(url)
          .expect(200)
      );

      const startTime = Date.now();
      await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      expect(totalTime).toBeLessThan(15000);
    });
  });

  describe('Data Validation', () => {
    it('should handle boundary values for id', async () => {
      const boundaryValues = [
        { id: '1', description: 'minimum valid id' },
        { id: '999999', description: 'large id' },
        { id: '0', description: 'zero id' },
        { id: '-1', description: 'negative id' }
      ];

      for (const { id, description } of boundaryValues) {
        const response = await request(app.getHttpServer())
          .get(`/horaire-des-cours?id=${id}`)
          .expect(200);

        // Should either return valid data or empty object
        expect(typeof response.body === 'object').toBe(true);
      }
    });

    it('should validate numeric id conversion', async () => {
      const nonNumericIds = ['abc', '1.5', '1e5', 'null', 'undefined'];

      for (const id of nonNumericIds) {
        const response = await request(app.getHttpServer())
          .get(`/horaire-des-cours?id=${id}`)
          .expect(200);

        // Should return empty object for invalid numeric ids
        expect(response.body).toEqual({});
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle URL encoding in id parameter', async () => {
      const encodedValues = [
        '%20', // space
        '%2B', // plus
        '%2F', // slash
        '%3D'  // equals
      ];

      for (const encoded of encodedValues) {
        await request(app.getHttpServer())
          .get(`/horaire-des-cours?id=${encoded}`)
          .expect(200);
      }
    });

    it('should handle mixed valid and invalid characters in id', async () => {
      const mixedIds = ['1a', '2b3', '4-5', '6_7'];

      for (const id of mixedIds) {
        const response = await request(app.getHttpServer())
          .get(`/horaire-des-cours?id=${id}`)
          .expect(200);

        expect(response.body).toEqual({});
      }
    });
  });

  describe('Business Logic Tests', () => {
    it('should return consistent data structure', async () => {
      // Test that all responses follow the same structure
      const allHoraires = await request(app.getHttpServer())
        .get('/horaire-des-cours')
        .expect(200);

      expect(Array.isArray(allHoraires.body)).toBe(true);

      if (allHoraires.body.length > 0) {
        const singleHoraire = await request(app.getHttpServer())
          .get(`/horaire-des-cours?id=${allHoraires.body[0].id}`)
          .expect(200);

        // Single horaire should have same structure as array elements
        const requiredFields = ['id', 'sigle', 'horaire', 'lieu', 'enseignants', 'mode_enseignement'];
        requiredFields.forEach(field => {
          expect(singleHoraire.body).toHaveProperty(field);
        });
      }
    });

    it('should maintain data integrity in responses', async () => {
      const response = await request(app.getHttpServer())
        .get('/horaire-des-cours?id=1')
        .expect(200);

      if (Object.keys(response.body).length > 0) {
        // Validate horaire is valid JSON if present
        if (response.body.horaire) {
          expect(() => JSON.parse(response.body.horaire)).not.toThrow();

          // Parse and validate the nested horaire structure
          const horaireData = JSON.parse(response.body.horaire);
          if (horaireData.sessions && horaireData.sessions.length > 0) {
            const session = horaireData.sessions[0];
            expect(session).toHaveProperty('jour');
            expect(session).toHaveProperty('activite');

            // Validate jour is a valid day (in French)
            if (session.jour) {
              const validDays = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
              expect(validDays).toContain(session.jour.toLowerCase());
            }
          }
        }

        // Validate trimestre format if present
        if (response.body.trimestre) {
          expect(response.body.trimestre).toMatch(/^(Automne|Hiver|Été)\s+\d{4}$/);
        }
      }
    });

    it('should validate JSON structure in horaire field', async () => {
      const allHoraires = await request(app.getHttpServer())
        .get('/horaire-des-cours')
        .expect(200);

      if (allHoraires.body.length > 0) {
        allHoraires.body.forEach(horaire => {
          if (horaire.horaire) {
            // Should be valid JSON
            expect(() => JSON.parse(horaire.horaire)).not.toThrow();

            const parsed = JSON.parse(horaire.horaire);
            if (parsed.sessions) {
              expect(Array.isArray(parsed.sessions)).toBe(true);
            }
          }
        });
      }
    });
  });
});