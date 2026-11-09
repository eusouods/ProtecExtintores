/* Public wall of verified, customer-authorized reviews. */
(() => {
  const host=document.getElementById('publicReviewList');if(!host)return;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  fetch((window.PROTEC_API_BASE_URL||'').replace(/\/$/,'')+'/api/public/reviews').then(async response=>{const data=await response.json().catch(()=>({}));if(!response.ok)throw Error('');const reviews=data.reviews||[];if(!reviews.length){host.closest('#publicReviews')?.remove();return}host.innerHTML=reviews.map(review=>`<article class="public-review"><div aria-label="Nota ${esc(review.rating)} de 5" class="review-stars">${'★'.repeat(Number(review.rating)||0)}${'☆'.repeat(Math.max(0,5-(Number(review.rating)||0)))}</div><p>${esc(review.comment||'Atendimento avaliado por cliente.')}</p>${review.response?`<p class="review-response"><b>Resposta da equipe:</b> ${esc(review.response)}</p>`:''}<small>Cliente verificado · ${esc(review.createdAt?new Date(review.createdAt).toLocaleDateString('pt-BR'):'')}</small></article>`).join('')}).catch(()=>host.closest('#publicReviews')?.remove());
})();
