import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { createResponse, handleOptions } from '../_shared/headers.ts'

function isLikelyDefaultAvatar(picture: string, name: string): boolean {
  if (!picture) return false;
  
  let url: URL;
  try {
    url = new URL(picture);
    
    // Validate Google user content domain and HTTPS
    if (url.protocol !== 'https:' || 
        !(url.hostname.endsWith('.googleusercontent.com') || 
          url.hostname === 'googleusercontent.com')) {
      return false;
    }
  } catch (error) {
    console.error('Invalid URL:', error);
    return false;
  }

  const params = url.search;
  
  // Check name format - default avatars often have:
  // - Initials (e.g. "WE")
  // - Single word names
  // - Names with dots or underscores
  const nameParts = name.split(' ');
  const hasInitials = nameParts.some(part => 
    part.length <= 2 || 
    part.includes('.') || 
    part.includes('_')
  );
  
  // Log the decision factors
  console.log('Avatar analysis:', {
    picture,
    name,
    nameParts,
    hasInitials,
    params
  });

  return hasInitials;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return handleOptions();
  }

  try {
    // Create a Supabase client with the service role key
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get users ordered by most recent first
    const { data: { users }, error: usersError } = await supabaseClient.auth.admin.listUsers({
      perPage: 50,
      page: 1,
      sortBy: {
        column: 'created_at',
        order: 'desc'
      }
    });

    if (usersError) throw usersError;

    // List of avatar URLs to exclude from the social proof section
    // To add more URLs in the future:
    // 1. Copy the exact URL of the avatar you want to exclude
    // 2. Add it to this EXCLUDED_AVATARS array
    // The avatar will be filtered out but the user will still be counted in totalCount
    const EXCLUDED_AVATARS = [
      'https://lh3.googleusercontent.com/a/ACg8ocKWSafnNZ4dNbK4Ii3RiSOtQF53hyaTQQsv2pXdf9OxkPQD_XcECA=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocIVDi1AUe_mPTpjwHfXMBM9wPWzkyxI7zxTPhwo9DcU6cj-9g=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocLmUFfLvFE-rDyxuypovzFbTMK47YX5qPXqZH76povqDGbqXA=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocJaZynRlRqNIZ5POFbikI0wJ37lJdAF4VmSuJZAkasXUFwQag=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocKRQPkpAXI0_Sy90AWrSFQLittALtHGg5TyfB58P0aRpVFCww=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocIfUUQzdk0fTgjNBNmAGN76one3yH3OJtuNsdIupsna2cByYQ=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocIqsBiZ76Udj9WEhUsy7yzGVvlZnPnl4vwRAyyj2SapR2Zgcw=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocKQ2UGcXv5tAyVyLy3uoPTnX08v5M37MddgmCcUM2BVxTtG2Mtc=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocJOfGjkCNWO3Ug1Vjbfb3__TOCIp7Sa55Vkm0xFubwbsv2G1N8=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocLWFS-BPEovd13FK0W0GyFHmTbn7MfDoJ0V8UkTSxzTsUXLtQ=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocJXeeqznQurIa93_I8aT7OQM5WOXZCuupy0et2BC8rO2xjuuw=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocJbukYoPGchbu29ch6848ocLU5UOjB3V_Xs7qBuPP3mjc8anA=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocLAAdWL4Oan1KG0J0ueR3UuWT15nQ5_kwdySVtov9adOojV1g=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocLuYJgHr3XXbfSCdnyEvQFO1GZuGaHvpd9LSiYT2wFHR7yjneo=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocKWOZcgvnzlIWG_YL7z23XsZOSCW5VgU00DUYmFuX47AILgzdw=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocLg8xckEclzFUwQL8Z06J4Tj8aOCJWcICzEflxaACp6VgYQXg=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocIEDpcnYPI2asuuQCzurwCaZoUN6E_Pox2yB_Fg8A30izZFVg=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocKHNZCZJ6qtGFXxwq210kKox_gggm6xneaMDC4FqdtVoofi0hQ=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocJHM2mmFk7DvpI99AU35Bq9zQJAUOxkFu9zdFKkDps_MfTM5Q=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocKzI7lnOmbUz_AEVGk5w1bqB837LLaxPhqPKDkRuQ98qv3yjQc=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocLqYKRvPVmjbuw4EMc04KJw_iLobVNBf2Zi89d-9UWEGSDXObM=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocJ4GP65DkFdo_NMyNefrPf9TGQ6boGdVHM-d5-KNoFHk_DAuB1A=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocLc-0SVpspwXvABceA1g-pN4NPxA2DSlwaNdPxzLoIJtdhLUXw=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocIQUt3ekai-xJbaadCH6L1bldAYKxP5ovaQUd70pHs7UMnXZ6Q=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocK1TGv16MJK4Ci9Z07xws49iwLX24zQX30wbWoipzjdnOCVBQ=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocKfzZYokmcYFp6ugqEIb7dn41luGdMBhhzB0a2G1qr6FTujScbm=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocK7lG-MW8bk_Cs3s8R343_ldKPkocffV1H8AQDKIY37QLjNVw=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocJ6XJ3b3929fhDeBkS2QpCS5yx1pSjdQ8s9zlvku61GtAhHCA=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocJi7fkKN9mJKRTc37RCOGRksY9ac7M4ovSD-E3Rz5g-1DR4PA=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocIR03ZfW7eDpmIEQ71ZC1Hij9EoowQdaMA7tMrqvhW_z_S7mA=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocK5nfD1Vi_nhy7_Y_B2PzsUsj0irERQ4D1j67NoH-wWW7ANWA=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocJgkGkdfBwK-cwcj0x4OUUxB1o_LVE0ETfgQVC2ha9PyrR3pA=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocKtFHYQE-d2WOp7cY95k60NeKV_CxbLV8a4gjtL5Lp4Jcs_Wg=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocJL6t-XFgcjLRkoCx9AcV3DYFtw9OA682auxbCMlpTPJZm3qw=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocJA72FWG6nDIN_mlMstLIBZ_4Iw36ikGjGaCqV-1lSZTCowig=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocI_Lvw9EQ6ViWs4NyqVfqy6hqpI8TD6FQRJG57AxZmWpzdJFg=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocLq791_3A6f-F_bT8GGC2LCbibQ0ECJL1G_R8y14MpXOC3gmfAC7g=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocJMZo-jxh0C8Taj_WeUZZLhuUYE-FidTBFIwIf6iQxptj8xsi5f=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocIUV4E42iCLdN1NBwxm8kNQloX690HCR9y5mH0LeebFgrclsQ=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocKVdpSKuMtrhvPAGGDwV4llJJsDrh-cl7Rtoq_UYw9HuAEJqA=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocJgon4S6BhKU2Yk9lKIfWl-lxb7MPQznsgg1zm6GBSynEWL2A=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocIH4vgaQr5OJ0ACbiebkIrrRV01DoZe-x1wkhMh-xyMxlWoLA=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocKlVRbgZNuyLfkjCrfHNqOwmMApXpesMEe9-gmPNwbSU2LIGg=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocKofIop6oNouMc5AHhTKkWiCAZ31s5iDVP9tuoPO3KmCLrjaw=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocI5Q328iTvVUEaOXu2oiEq1U0Lhkel7Qowt_4yRLvCI4wAq3Mo=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocKchIO_H9eBRBJuPx76o_KV_sz_y7LH_YdjeQMHE9i81zdmAQ=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocLAMBh2PQIjgAfWXFYxTwNUijIOdaXKI80p3eSGJ4S23JtSJQ=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocLWYiy_0yEP5xkDXi3ml4zqm96oVFF3zQcThq8fXnFrlmmDIw=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocK_dRDoQ-tgeE2X8bJu5tr7C9GLfXUyAPTJdgl42mzHRemoTQ=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocIZzxebyi0hwoyiSleWp8nb-MVPvvDGDiyoErPD_wzTzHLSbQ=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocJa12bBiWwTgDq0rb0foKqFxdcFKOm7c4qB8w11gds43xlT2ay8=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocJ5uS6FUGq3gn9zu7_p2D8_Iux79131TdJzhDIbdJ2eLYgvpw=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocIhfHHeINmwQ9kGA2F0A23itENv6wn4Xg-9eW_csSEgxwKQwA=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocLjJunTAQFq__rUFnAELRVnyx4vlcz02vTxuQ7EF2QyAMTBxg=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocL0wCLgpuWHO1eAv5SAzTfcSx6ILe-uZRQ_KGIayNf5ZYPt_g=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocLVaSjIVQBEe179WEZoqv19xIiV-9g-fkqLH8iN2nrr6hbdcQ=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocKicDfj99enJ8vVnf_-flYJDVE3rflpNKWe2xYGze03IHCF6g=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocK5HtY0odavGj7-My9S_qIc-X3hrCTsDUC_NdpsUVpXcPWXtk5h=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocKqdVelnFBViEebz3WjgjvMjWjxChxydK1wYiGlf6BbDBMefhwE=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocIfdr3ElKuAXexixnAhqaUKri38hucEqEaERJDUcNDtD_HRyA=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocJ_V1Xk9IXTo-kwZuqBB7nNhD5gCyQ-uYULP-ZCE2G8u7IDpocR=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocKBGXm9_jq4UbnAogHTfOwZK6dglInN41OrFGwMaPBjaGKipQ=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocLiXqQl-aeFf2TtDpOk8Ny393zSX6DQ4b_cGmCodu0PqIm5bA=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocJXCAoOKCAUZrYyKQ1k8O8oNR5HG-TYDra-6bEnoa1tMqGHJA=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocJEzXFuspeb-Nm-KJVwx2Uy-h5JJRH3iN-mObGWY32RkBL_lw=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocIOOEwMxNxuo-SKzyeHCD176subOKDyyndvIRQYDtd-xGpGEw=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocIXFuR9JvGGlamfZeuqYXMoxZZSE4lEyr_X1orB38ITle0wug=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocK1Tmwf_gKLqE2NvbU5knD9eYvohKuUBomArWCXElcqo_tWyQ=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocJzGyCHWKdtXvTvldLSL184B7zwOU1lXziQBMw5-zZMSU21naI=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocJK-BQFKR5yIfr-IWh1zIWq74Nh0Wmdo4191s3hHR5QqLFoug=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocLkxma8DpxT0ZII7LPtceYEKCqE9YqIxnbQ7C3Lh-mm6qEgPw=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocLEGOYX0m6p-YNwnDboJaBiggupM7yasXKXOiehw0TpPy2B6RJA=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocKGHBten26TJXgsfxcO73vvF-wcP2QzSSXeSFIInEdIjQ8bQg=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocIgCgYKMPamse8r5BoOiGV_RKaQkbnvRwCxaBAUjDVq83c1-GA=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocI_mmLEFvpZu0Kw0OrHfU5Mq9BpCgWC2oRiXwIzQsgF2nN4IA=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocJZC4waIeMll1C1V69PymnlEqkH_MhDZ55bXXAgHfpsJZlt-rs=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocLYFTQBwqiR48PD2NxZdP8QrJXKLpVtS9gOtpH5zERM5jCTqPM=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocLjFYU4tnaLYzB4djbXnhTF-VmUupRdZyfFslUrmN2w6n6O6Q=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocJUzEV6WjIXrPa821J_RrW88t2MOCScg5NP2i7LNHzbSbkHRQ=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocIQHIlSlncm99GDjENsAN931l_9TrIH-IcTRfAzFgOsjGKqOg=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocLJOE5_jBL2Fch0ho9HIojYHwxGT2nmmp-bCrDP_UiLBXgMdPZq=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocKja5TKjYxV_odmezEZ-Fm2PifBqTkb8ZonkCaj6EhZOu8MBvw=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocK-uBy7y_N4qeI4h1mMt5TdjE_ZstoNqoSy3l4-OlyeiGEdAw=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocIHTXaWAorXs9PokcdwZgomxx_lOMIgvrdC962pGfIdxQGDz4N4=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocLahbZStkVAm59Sw8BKxGPATPMJmaGABjF8-Klgjcj3NS9kpM8=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocJ-v2AZtiRcC0GhbZAXIQzl0TjfAv8gcT1Jhjp5nMnsomzicAk=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocJqyuiSUgJYAwYgls6uTKqPQIk1n0A_hgUNg26sRNLiqOohzg=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocKzHEg3eC6H5wK1CyT7uR1NYp87t-mJFXo86bLVWl26vICuFA=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocJcb2dCN7NSy41FczYWQu0OdM-uRY_PrbvHmDzPZUtk05NeYw=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocK8o5EDRI3XE-jnSQH8isKyNzs9CmAwHyU6mlqhG4OnpI1UFw=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocKSB1K9L_M5I-c4ZvDugrSzX2qvXkvxLCGORt-eAKTuiwhnfOf4=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocL4Oobo5pw7DcXp1iykme6UI_1Zt7Ogz2Uguh-kWnNfN8jTGA=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocLd0oBK7_efKBU_1eDwBp2eE0uTtS8LHcuXO31vZYgnou2C3A=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocKGszo1eNkj7LQzZL0DSZxZTN5AS0s3_zn1bMOuWXLyMLeBQQ=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocIi40DUmOyH-6yAgjs0rkzH_DQvLW2jEESsSCfnNiw64bAKbA=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocJtxMkozJRS_LyBiKSb2GGdCghTnbumpc00mJxPzAwAvalGlg=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocJ4iN5AemPI7Meg3sWAdmxy0ySBCaqJCFk0gLCqs4F5CA14qg=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocL54QjMO4gczEpoesNZn-ML3QPHuA6MDTSPgbzNWNpEpQFptA=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocLIWy5qfanQHErqKmWPoVOUoPLcWzLdGcFIR8fo83m6CZqTofPN=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocK6bza_uIk7UR7uDGLnVEkMaUaMwvJfFaGwqyVQLvyV8Oh7QE_V=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocL2DWxVLjw4JdFTeEQ3J6QGZGQ_PBHW5HdbrfwZa97p1_CXC0k=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocJ7KhZPwlqqFwLO4FMpDh3zttFTS80RBftPZCDY7UmeDjklb5A=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocKJO--BRTx-u2JShV3PNn6tmHjb5qzjGO-hjSozn1iS-yUMOA=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocInn7tHMs-rmXrpYn8Rh3xwlvFaccgg_RCTxSxY71UkLfrvyQ=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocLiEmXOKlcV5oFWvdhK6mKRRU4BrGRU4zWyROhWepwFPwFO8Q=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocKouCQNF3UV0CfidWq1gt_ePmg0_ZSitttnjJWNXeOCh3xMLw=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocLE2hTLTUO5HACHs7__j1PO3pKn5VshBSXrLm6ZJ3bbIGxcC9E=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocJCiS5pxyDq8Gi2JLkvqQnPvwsBaxuMq3jXAW886GVJfJ-etXU=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocIpYBSJgtEzBjA0IskZGT9E5S8vVK3SNYIj6YiTNMVUcnSERw=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocIUQS5cnlSGwShQBl-bQnLmTZNGzBvgUENnQTbcYghQAMwlYw=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocIaY0gQpAAMnJdsoeeAEWivAcSuFAeuPBDQrywI2twKwyik9Q=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocJqoFc1xtlMjHpyBKCDc_Iv7mQut5-T98YzhLjea7y3bpGLtG6w=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocJiPyohs7RZuAott0WV4NQdw3npqsbsVHeLjcZQ7IY6Y4EP2hHdDA=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocJOXvf-weFmVWadJLsDSc6gJCXjQAzSRjlnBjn_HCt7K4ISGQCicw=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocLOptZyD2F_5hM-4c5E6YlowORYZaINqAD-nieL0PoyNIkX-w=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocKx6YGoRivPdiL9rJzO-n500kIRO1DdKI_fu-UO5PYMm8x6Xzgs=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocIhS8P1kpQ0PUP3C2KhqKJ80ULF2u5G6JYk60aO0wEdV2wG3g=s96-c',
      'https://lh3.googleusercontent.com/a/ACg8ocJij-u2NaNPbImIzL2fKi7Y0vd0bnnCb_R37yxBCIcOZ3YX9v4=s96-c'


    ];

    // Map users to get their metadata
    const recentUsers = users
      .map(user => {
        // Try to get picture from various sources
        const picture = 
          user.user_metadata?.avatar_url || // Custom avatar
          user.user_metadata?.picture || // OAuth picture
          user.identities?.[0]?.identity_data?.avatar_url || // Identity avatar
          user.identities?.[0]?.identity_data?.picture; // Identity picture

        const name = user.user_metadata?.name || user.user_metadata?.full_name || '';
        
        const isDefault = isLikelyDefaultAvatar(picture, name);

        // Log decision for debugging
        console.log(`User ${user.id}:`, {
          name,
          picture,
          isDefault,
          decision: isDefault ? 'filtered out' : 'kept'
        });

        return {
          name,
          picture,
          isDefault
        };
      })
      .filter(user => {
        if (!user.picture) return false;
        if (EXCLUDED_AVATARS.includes(user.picture)) return false;
        return !user.isDefault;
      })
      .slice(0, 7);

    // Get total count
    const { data: { total }, error: countError } = await supabaseClient.auth.admin.listUsers({
      perPage: 1,
      page: 1
    });

    if (countError) throw countError;

    // Return the response with headers
    return createResponse({
      recentUsers,
      totalCount: total || 0
    });

  } catch (error) {
    console.error('Error:', error.message)
    
    // Return error response with headers
    return createResponse(
      { error: error.message },
      { status: 500 }
    );
  }
});
