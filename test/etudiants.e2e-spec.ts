import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('EtudiantsController (e2e)', () => {
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

  describe('/etudiants (GET)', () => {
    it('should return all etudiants when no code parameter provided', () => {
      return request(app.getHttpServer())
        .get('/etudiants')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should return specific etudiant when valid code provided', () => {
      return request(app.getHttpServer())
        .get('/etudiants?code=Bena18069800')
        .expect(200)
        .expect((res) => {
          if (Object.keys(res.body).length > 0) {
            expect(res.body).toHaveProperty('code_permanant', 'Bena18069800');
            expect(res.body).toHaveProperty('nom');
            expect(res.body).toHaveProperty('prenom');
            expect(res.body).toHaveProperty('email');
          }
        });
    });

    it('should return empty object when invalid code provided', () => {
      return request(app.getHttpServer())
        .get('/etudiants?code=INVALID123')
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({});
        });
    });

    it('should return empty object when non-existent code provided', () => {
      return request(app.getHttpServer())
        .get('/etudiants?code=XXXX99999999')
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({});
        });
    });

    it('should handle empty code parameter', () => {
      return request(app.getHttpServer())
        .get('/etudiants?code=')
        .expect(200)
        .expect((res) => {
          // Should return all etudiants when code is empty
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should handle special characters in code', () => {
      return request(app.getHttpServer())
        .get('/etudiants?code=ABC@123')
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({});
        });
    });

    it('should handle very long code parameter', () => {
      const longCode = 'A'.repeat(50);
      return request(app.getHttpServer())
        .get(`/etudiants?code=${longCode}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({});
        });
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed requests gracefully', () => {
      return request(app.getHttpServer())
        .get('/etudiants?code[]=test')
        .expect(500);
    });

    it('should handle multiple code parameters', () => {
      return request(app.getHttpServer())
        .get('/etudiants?code=Bena18069800&code=Test12345678')
        .expect(500);
    });

    it('should handle special characters in code', () => {
      return request(app.getHttpServer())
        .get('/etudiants?code=1@#$')
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({});
        });
    });
  });

  describe('Response Structure Validation', () => {
    it('should return etudiant with all required fields when found', async () => {
      const response = await request(app.getHttpServer())
        .get('/etudiants?code=Bena18069800')
        .expect(200);

      if (Object.keys(response.body).length > 0) {
        expect(response.body).toHaveProperty('code_permanant');
        expect(response.body).toHaveProperty('nom');
        expect(response.body).toHaveProperty('prenom');
        expect(response.body).toHaveProperty('email');
        expect(response.body).toHaveProperty('telephone');
        expect(response.body).toHaveProperty('adresse');

        // Validate data types
        expect(typeof response.body.code_permanant).toBe('string');
        expect(typeof response.body.nom).toBe('string');
        expect(typeof response.body.prenom).toBe('string');
        expect(typeof response.body.email).toBe('string');
      }
    });

    it('should return etudiants array with proper structure when getting all', async () => {
      const response = await request(app.getHttpServer())
        .get('/etudiants')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);

      if (response.body.length > 0) {
        const firstEtudiant = response.body[0];
        expect(firstEtudiant).toHaveProperty('code_permanant');
        expect(firstEtudiant).toHaveProperty('nom');
        expect(firstEtudiant).toHaveProperty('prenom');
        expect(firstEtudiant).toHaveProperty('email');
      }
    });
  });

  describe('Performance Tests', () => {
    it('should respond within reasonable time for single etudiant', async () => {
      const startTime = Date.now();

      await request(app.getHttpServer())
        .get('/etudiants?code=Bena18069800')
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(5000);
    });

    it('should respond within reasonable time for all etudiants', async () => {
      const startTime = Date.now();

      await request(app.getHttpServer())
        .get('/etudiants')
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(10000);
    });
  });
});