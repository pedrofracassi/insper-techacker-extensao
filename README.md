# Xereta Score

![image](https://i.imgur.com/D8oQzTu.png)

O Xereta Score é uma pontuação de 0 a 100 que mede o quão invasivo um site é em termos de privacidade. Quanto maior a pontuação, mais invasivo é o site.

## Como é calculado

### Armazenamento Local (Máximo: 10 pontos)
- 0,5 pontos para cada KB de dados armazenados

### Cookies de Primeira Parte (Máximo: 15 pontos)

![image](https://i.imgur.com/0ur1hrR.png)

- Cookies são classificados em categorias através de integração com o [Open Cookie Database](https://github.com/jkwakman/Open-Cookie-Database)
  - Marketing
  - Analytics
  - Essencial
  - Funcional
  - Personalização
  - Outros
- 1 ponto por cookie, 2 se for de analytics, 3 se for de marketing
- Quanto mais cookies, maior a pontuação

### Cookies de Terceira Parte (Máximo: 20 pontos)
- 2 pontos por cookie, 4 se for de analytics, 5 se for de marketing

### Canvas Fingerprinting (15 pontos)
- 15 pontos se detectado

### Domínios de Terceiros (Máximo: 40 pontos)

![image](https://i.imgur.com/EK8UocE.png)

- 1 ponto por domínio externo
- 3 pontos extras se o domínio estiver na lista [oisd](https://oisd.nl/).

## Interpretação do Score
- 0-20 (Verde): Boa privacidade
- 21-40 (Amarelo): Privacidade moderada
- 41-60 (Laranja): Privacidade baixa
- 61-100 (Vermelho): Privacidade muito baixa